-- Introduce an explicit, one-to-one mapping between stable application users and
-- Clerk identities.  The accompanying migrate-clerk-identities.ts command fills
-- this column after checking all legacy email matches for ambiguity.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_user_id varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique
  ON users (clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;
