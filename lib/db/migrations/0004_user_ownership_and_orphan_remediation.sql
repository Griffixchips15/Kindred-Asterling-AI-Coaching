-- Ownership hardening migration.
-- This report is intentionally durable. Orphans are deleted, never reassigned to
-- a guessed account. Review/export privacy_migration_orphans before migration.
BEGIN;
CREATE TABLE IF NOT EXISTS privacy_migration_orphans (
  id bigserial PRIMARY KEY,
  migration varchar NOT NULL,
  source_table varchar NOT NULL,
  source_key text NOT NULL,
  former_user_id varchar,
  reason text NOT NULL,
  resolution varchar NOT NULL CHECK (resolution IN ('deleted')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text; owner_col text := 'user_id';
BEGIN
  FOREACH t IN ARRAY ARRAY['morning_logs','evening_reports','body_scans','habits','habit_entries','daily_usage','conversations','medications','medication_logs','medication_schedule_entries','reminder_deliveries','email_verification_tokens'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('INSERT INTO privacy_migration_orphans(migration,source_table,source_key,former_user_id,reason,resolution) SELECT %L,%L,ctid::text,user_id,CASE WHEN user_id IS NULL THEN %L ELSE %L END,%L FROM %I r WHERE user_id IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id=r.user_id)', '0004',t,'missing owner','owner does not exist','deleted',t);
      EXECUTE format('DELETE FROM %I r WHERE user_id IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id=r.user_id)', t);
    END IF;
  END LOOP;
END $$;

-- A habit entry whose duplicated owner differs from its parent is unsafe. Delete
-- and report it rather than choosing either account.
INSERT INTO privacy_migration_orphans(migration,source_table,source_key,former_user_id,reason,resolution)
SELECT '0004','habit_entries',e.id::text,e.user_id,'entry owner differs from habit owner','deleted'
FROM habit_entries e JOIN habits h ON h.id=e.habit_id WHERE e.user_id <> h.user_id;
DELETE FROM habit_entries e USING habits h WHERE e.habit_id=h.id AND e.user_id<>h.user_id;

ALTER TABLE morning_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE evening_reports ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE body_scans ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE habits ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE habit_entries ALTER COLUMN user_id SET NOT NULL;

DO $$
DECLARE t text; cname text; existing record;
BEGIN
  FOREACH t IN ARRAY ARRAY['morning_logs','evening_reports','body_scans','habits','habit_entries','daily_usage','conversations','medications','medication_logs','medication_schedule_entries','reminder_deliveries','email_verification_tokens'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      -- Replace, rather than stack, old NO ACTION ownership constraints.
      FOR existing IN SELECT c.conname FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=ANY(c.conkey) WHERE c.contype='f' AND r.relname=t AND a.attname='user_id' LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',t,existing.conname);
      END LOOP;
      cname := t || '_user_id_users_id_fk';
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID',t,cname);
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I',t,cname);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(user_id)', t || '_user_idx', t);
    END IF;
  END LOOP;
END $$;

-- Administrative actor references are anonymized, not allowed to block account deletion.
ALTER TABLE beta_grants ALTER COLUMN granted_by DROP NOT NULL;
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='beta_grants'::regclass AND contype='f' AND confrelid='users'::regclass AND conname NOT LIKE '%user_id%' LOOP
    EXECUTE format('ALTER TABLE beta_grants DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
ALTER TABLE beta_grants ADD CONSTRAINT beta_grants_granted_by_users_id_fk FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE beta_grants ADD CONSTRAINT beta_grants_revoked_by_users_id_fk FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS beta_grants_granted_by_idx ON beta_grants(granted_by);
CREATE INDEX IF NOT EXISTS beta_grants_user_idx ON beta_grants(user_id);
CREATE INDEX IF NOT EXISTS entitlement_audit_user_idx ON entitlement_audit(user_id);
CREATE INDEX IF NOT EXISTS entitlement_audit_actor_idx ON entitlement_audit(actor_id);
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='entitlement_audit'::regclass AND contype='f' AND confrelid='users'::regclass AND conname LIKE '%actor%' LOOP
    EXECUTE format('ALTER TABLE entitlement_audit DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
ALTER TABLE entitlement_audit ADD CONSTRAINT entitlement_audit_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);
COMMIT;
