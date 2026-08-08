-- Adds medication schedule history so the weekly report can judge each past day
-- against the schedule that was actually in effect that day (not the current one).
--
-- Each row in medication_schedule_entries is one scheduled time that was in
-- effect for a medication over a date range. endDate NULL means still active;
-- a time is active on day D iff start_date <= D AND (end_date IS NULL OR D < end_date).
--
-- Idempotent: the table is created IF NOT EXISTS, and the backfill only seeds
-- medications that have no schedule rows yet. Safe to run before `drizzle-kit push`.


CREATE TABLE IF NOT EXISTS medication_schedule_entries (
  id serial PRIMARY KEY,
  medication_id integer NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_time text NOT NULL,
  start_date date NOT NULL,
  end_date date
);

CREATE INDEX IF NOT EXISTS medication_schedule_entries_med_idx
  ON medication_schedule_entries (medication_id);

-- Backfill: for every existing medication that has no schedule history yet,
-- seed one active entry per current scheduled time, effective from the day the
-- medication was created. This treats the current schedule as having been in
-- effect since creation, which is the best retroactive approximation.
INSERT INTO medication_schedule_entries (medication_id, user_id, scheduled_time, start_date, end_date)
SELECT m.id, m.user_id, t.time, (m.created_at)::date, NULL
FROM medications m
CROSS JOIN LATERAL unnest(m.times) AS t(time)
WHERE NOT EXISTS (
  SELECT 1 FROM medication_schedule_entries e WHERE e.medication_id = m.id
);
