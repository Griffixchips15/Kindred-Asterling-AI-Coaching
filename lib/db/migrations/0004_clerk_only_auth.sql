-- REVIEWED DESTRUCTIVE MIGRATION: apply through the normal migration runner.
-- Do not use `drizzle-kit push`; Clerk is now authoritative for these values.
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS sessions;

ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS profile_image_url,
  DROP COLUMN IF EXISTS email_verified_at;
