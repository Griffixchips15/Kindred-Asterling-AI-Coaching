import { MongoClient, type Db } from "mongodb";
import {
  OrderIndependentDigest,
  expectedMigrationCollections,
  validateMigrationCollectionNames,
} from "../src/migrationSupport";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function digestCollection(database: Db, name: string) {
  const digest = new OrderIndependentDigest();
  let rows = 0;
  for await (const document of database.collection(name).find()) {
    digest.add(document);
    rows += 1;
  }
  return { rows, digest: digest.hex() };
}

async function collectionNames(database: Db): Promise<string[]> {
  return (await database.listCollections({}, { nameOnly: true }).toArray()).map(
    ({ name }) => name,
  );
}

export async function validateMongoRestore(): Promise<void> {
  const uri = required("MONGODB_URI");
  const sourceName = required("MONGODB_VALIDATION_SOURCE_DATABASE");
  const restoredName = required("MONGODB_VALIDATION_RESTORE_DATABASE");
  if (sourceName === restoredName) {
    throw new Error(
      "MongoDB validation source and restore databases must differ",
    );
  }
  const client = new MongoClient(uri, {
    appName: "kindred-mongodb-restore-validation",
    maxPoolSize: 5,
  });
  try {
    await client.connect();
    const source = client.db(sourceName);
    const restored = client.db(restoredName);
    validateMigrationCollectionNames(await collectionNames(source));
    validateMigrationCollectionNames(await collectionNames(restored));
    for (const name of expectedMigrationCollections) {
      const [left, right] = await Promise.all([
        digestCollection(source, name),
        digestCollection(restored, name),
      ]);
      if (left.rows !== right.rows || left.digest !== right.digest) {
        throw new Error(
          `${name} restore parity failure: source=${left.rows}/${left.digest} restored=${right.rows}/${right.digest}`,
        );
      }
      console.log(`${name}: ${left.rows} rows restored and verified`);
    }
  } finally {
    await client.close();
  }
}

await validateMongoRestore();
