/** One-time legacy migration. Run after database migration 0004. */
import { createClerkClient } from "@clerk/backend";
import pg from "pg";
import { planLegacyIdentityMigration } from "../src/lib/clerkIdentityMigration";

if (!process.env.DATABASE_URL || !process.env.CLERK_SECRET_KEY) {
  throw new Error("DATABASE_URL and CLERK_SECRET_KEY are required");
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const { rows: legacyUsers } = await client.query<{
    id: string;
    email: string | null;
    clerkUserId: string | null;
  }>('SELECT id, email, clerk_user_id AS "clerkUserId" FROM users');

  const clerkUsers: Array<{ id: string; primaryEmail: string | null }> = [];
  let offset = 0;
  for (;;) {
    const page = await clerk.users.getUserList({ limit: 100, offset });
    for (const user of page.data) {
      const primary = user.emailAddresses.find(
        ({ id }) => id === user.primaryEmailAddressId,
      );
      clerkUsers.push({
        id: user.id,
        primaryEmail: primary?.emailAddress ?? null,
      });
    }
    offset += page.data.length;
    if (offset >= page.totalCount || page.data.length === 0) break;
  }

  const plan = planLegacyIdentityMigration(legacyUsers, clerkUsers);
  if (plan.ambiguous.length > 0) {
    console.error(JSON.stringify({ ambiguous: plan.ambiguous }, null, 2));
    throw new Error(
      "Ambiguous Clerk identity matches require manual resolution",
    );
  }

  await client.query("BEGIN");
  try {
    for (const mapping of plan.mappings) {
      await client.query(
        "UPDATE users SET clerk_user_id = $1, updated_at = now() WHERE id = $2",
        [mapping.clerkUserId, mapping.userId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  console.log(
    `Mapped ${plan.mappings.length} legacy users to Clerk identities.`,
  );
} finally {
  await client.end();
}
