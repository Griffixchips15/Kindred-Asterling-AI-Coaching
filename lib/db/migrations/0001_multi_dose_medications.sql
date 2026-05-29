-- Data-preserving migration: single-time medications -> multi-dose medications.
--
-- Transforms the OLD medication schema (one `time_of_day` per medication, one
-- log per (user, medication, date)) into the NEW schema (a `times[]` list per
-- medication and one log per (user, medication, date, scheduled_time)) WITHOUT
-- losing existing medications or past logs.
--
-- Safe to run on a production DB that still has the old `time_of_day` column.
-- Idempotent: re-running after a successful run is a no-op (statements that
-- reference the legacy `time_of_day` column are wrapped in dynamic SQL that
-- only executes when that column still exists, so they don't fail to parse
-- once it has been dropped). Run this BEFORE `drizzle-kit push` on production —
-- a plain push would drop `time_of_day` and with it every medication's schedule
-- and every log's dose mapping.

BEGIN;

-- 1. medications: add times[] and backfill from the single time_of_day.
ALTER TABLE medications ADD COLUMN IF NOT EXISTS times text[];

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'time_of_day'
  ) THEN
    EXECUTE 'UPDATE medications SET times = ARRAY[time_of_day] '
         || 'WHERE times IS NULL AND time_of_day IS NOT NULL';
  END IF;
END $$;

-- Any rows still without a schedule (no legacy time_of_day) get a sane default.
UPDATE medications SET times = ARRAY['08:00'] WHERE times IS NULL OR cardinality(times) = 0;

ALTER TABLE medications ALTER COLUMN times SET NOT NULL;

-- 2. medication_logs: add scheduled_time and backfill from the owning med's
--    legacy time_of_day so each existing log keeps showing as taken.
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS scheduled_time text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'time_of_day'
  ) THEN
    EXECUTE 'UPDATE medication_logs ml SET scheduled_time = m.time_of_day '
         || 'FROM medications m WHERE ml.medication_id = m.id '
         || 'AND ml.scheduled_time IS NULL AND m.time_of_day IS NOT NULL';
  END IF;
END $$;

-- Fallback for any logs whose med had no legacy time_of_day.
UPDATE medication_logs SET scheduled_time = '08:00' WHERE scheduled_time IS NULL;

ALTER TABLE medication_logs ALTER COLUMN scheduled_time SET NOT NULL;

-- 3. Swap the uniqueness rule from (user, med, date) to (user, med, date, time).
DROP INDEX IF EXISTS medication_logs_user_med_date_unique;
CREATE UNIQUE INDEX IF NOT EXISTS medication_logs_user_med_date_time_unique
  ON medication_logs (user_id, medication_id, date, scheduled_time);

-- 4. Now that data is preserved, drop the legacy single-time column.
ALTER TABLE medications DROP COLUMN IF EXISTS time_of_day;

COMMIT;
