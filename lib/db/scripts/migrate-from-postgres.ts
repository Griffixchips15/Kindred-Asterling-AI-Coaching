import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient, type Db, type Document } from "mongodb";
import pg from "pg";
import { allTables } from "../src/mongoSchema";
import { initializeMongoIndexes } from "../src/mongoDb";
import { OrderIndependentDigest, transformRow } from "../src/migrationSupport";

const { Client: PostgresClient } = pg;
const BATCH_SIZE = 1_000;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

type TableDefinition = {
  name: string;
  primaryKey: string[];
};

type TableReport = {
  table: string;
  rows: number;
  sourceDigest: string;
  targetDigest: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function quotedIdentifier(value: string): string {
  if (!IDENTIFIER.test(value))
    throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

async function discoverTables(source: pg.Client): Promise<TableDefinition[]> {
  const tables = await source.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  const keys = await source.query<{
    table_name: string;
    column_name: string;
    ordinal_position: number;
  }>(
    `SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position`,
  );
  const byTable = new Map<string, string[]>();
  for (const key of keys.rows) {
    const columns = byTable.get(key.table_name) ?? [];
    columns.push(key.column_name);
    byTable.set(key.table_name, columns);
  }
  return tables.rows.map(({ table_name }) => ({
    name: table_name,
    primaryKey: byTable.get(table_name) ?? [],
  }));
}

async function migrateTable(
  source: pg.Client,
  target: Db,
  definition: TableDefinition,
): Promise<TableReport> {
  const sourceDigest = new OrderIndependentDigest();
  const cursor = `kindred_${definition.name}_${randomUUID().replaceAll("-", "")}`;
  const order =
    definition.primaryKey.length > 0
      ? ` ORDER BY ${definition.primaryKey.map(quotedIdentifier).join(", ")}`
      : " ORDER BY ctid";
  await source.query(
    `DECLARE ${quotedIdentifier(cursor)} NO SCROLL CURSOR FOR SELECT * FROM ${quotedIdentifier(definition.name)}${order}`,
  );
  let rows = 0;
  try {
    while (true) {
      const batch = await source.query<Record<string, unknown>>(
        `FETCH FORWARD ${BATCH_SIZE} FROM ${quotedIdentifier(cursor)}`,
      );
      if (batch.rows.length === 0) break;
      const documents = batch.rows.map((row) =>
        transformRow(definition.name, row, definition.primaryKey),
      );
      for (const document of documents) sourceDigest.add(document);
      await target.collection(definition.name).insertMany(documents, {
        ordered: true,
      });
      rows += documents.length;
      console.log(`${definition.name}: ${rows} rows copied`);
    }
  } finally {
    await source.query(`CLOSE ${quotedIdentifier(cursor)}`);
  }

  const targetDigest = new OrderIndependentDigest();
  let targetRows = 0;
  for await (const document of target.collection(definition.name).find()) {
    targetDigest.add(document);
    targetRows += 1;
  }
  if (targetRows !== rows || targetDigest.hex() !== sourceDigest.hex()) {
    throw new Error(
      `${definition.name} parity failure: source=${rows}/${sourceDigest.hex()} target=${targetRows}/${targetDigest.hex()}`,
    );
  }
  return {
    table: definition.name,
    rows,
    sourceDigest: sourceDigest.hex(),
    targetDigest: targetDigest.hex(),
  };
}

async function countOrphans(
  database: Db,
  child: string,
  field: string,
  parent: string,
): Promise<number> {
  const [result] = await database
    .collection(child)
    .aggregate<{ count: number }>([
      { $match: { [field]: { $ne: null } } },
      {
        $lookup: {
          from: parent,
          localField: field,
          foreignField: "_id",
          as: "_parent",
        },
      },
      { $match: { _parent: { $size: 0 } } },
      { $count: "count" },
    ])
    .toArray();
  return result?.count ?? 0;
}

async function validateReferences(database: Db): Promise<void> {
  const userOwned = [
    "beta_grants",
    "body_scans",
    "calendar_connections",
    "conversations",
    "daily_usage",
    "entitlement_audit",
    "evening_reports",
    "habit_entries",
    "habits",
    "medication_logs",
    "medication_schedule_entries",
    "medications",
    "morning_logs",
    "reminder_deliveries",
    "reminder_settings",
    "subscriptions",
  ];
  const checks: Array<[string, string, string]> = userOwned.map((name) => [
    name,
    "userId",
    "users",
  ]);
  checks.push(
    ["messages", "conversationId", "conversations"],
    ["habit_entries", "habitId", "habits"],
    ["medication_logs", "medicationId", "medications"],
    ["medication_schedule_entries", "medicationId", "medications"],
    ["beta_grants", "grantedBy", "users"],
    ["beta_grants", "revokedBy", "users"],
    ["entitlement_audit", "actorId", "users"],
  );
  const collections = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(
      ({ name }) => name,
    ),
  );
  for (const [child, field, parent] of checks) {
    if (!collections.has(child) || !collections.has(parent)) continue;
    const orphans = await countOrphans(database, child, field, parent);
    if (orphans > 0) {
      throw new Error(`${child}.${field} has ${orphans} orphaned references`);
    }
  }
}

async function initializeCounters(database: Db): Promise<void> {
  for (const table of allTables) {
    if (!table.autoIncrement) continue;
    const [latest] = await database
      .collection(table.collectionName)
      .find({}, { projection: { [table.autoIncrement]: 1 } })
      .sort({ [table.autoIncrement]: -1 })
      .limit(1)
      .toArray();
    const value = latest?.[table.autoIncrement];
    await database
      .collection<any>("_counters")
      .updateOne(
        { _id: table.collectionName },
        { $set: { value: typeof value === "number" ? value : 0 } },
        { upsert: true },
      );
  }
}

export async function runMigration(): Promise<void> {
  const sourceUrl = required("POSTGRES_SOURCE_URL");
  const mongoUri = required("MONGODB_URI");
  const targetName = required("MONGODB_MIGRATION_DATABASE");
  if (targetName === process.env.MONGODB_DATABASE?.trim()) {
    throw new Error(
      "MONGODB_MIGRATION_DATABASE must differ from MONGODB_DATABASE",
    );
  }

  const source = new PostgresClient({
    connectionString: sourceUrl,
    ssl: process.env.PG_SSL_CA
      ? { ca: process.env.PG_SSL_CA, rejectUnauthorized: true }
      : undefined,
  });
  const mongo = new MongoClient(mongoUri, {
    appName: "kindred-postgres-migration",
    maxPoolSize: 10,
    retryWrites: true,
  });

  try {
    await source.connect();
    await mongo.connect();
    const target = mongo.db(targetName);
    const existingCollections = await target
      .listCollections({}, { nameOnly: true })
      .toArray();
    if (existingCollections.length > 0) {
      throw new Error(
        `Migration target ${targetName} is not empty; use a new staging database`,
      );
    }

    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const startedAt = new Date();
    const tables = await discoverTables(source);
    if (tables.length === 0) throw new Error("No PostgreSQL tables discovered");
    const reports: TableReport[] = [];
    try {
      for (const table of tables) {
        reports.push(await migrateTable(source, target, table));
      }
      await source.query("COMMIT");
    } catch (error) {
      await source.query("ROLLBACK");
      throw error;
    }

    await validateReferences(target);
    await initializeMongoIndexes(target);
    await initializeCounters(target);
    const report = {
      status: "validated",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      source: "postgresql-read-only-snapshot",
      targetDatabase: targetName,
      tables: reports,
      totalRows: reports.reduce((sum, table) => sum + table.rows, 0),
    };
    const reportPath =
      process.env.MONGODB_MIGRATION_REPORT_PATH ??
      `mongodb-migration-report-${startedAt.toISOString().replaceAll(":", "-")}.json`;
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(`Migration validated. Report: ${reportPath}`);
  } finally {
    await Promise.allSettled([source.end(), mongo.close()]);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) await runMigration();
