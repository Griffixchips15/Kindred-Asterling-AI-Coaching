-- Adds password credentials for the email/password authentication flow.
-- Existing users remain valid and can be assigned a password separately.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash varchar;
