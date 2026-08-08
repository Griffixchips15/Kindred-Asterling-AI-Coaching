DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM
    ('pending', 'active', 'past_due', 'cancel_at_period_end', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE subscriptions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE subscriptions ALTER COLUMN status TYPE subscription_status USING
  (CASE WHEN status = 'active' THEN 'active' ELSE 'expired' END)::subscription_status;
ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_event_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_customer_id_unique
  ON subscriptions(payment_customer_id) WHERE payment_customer_id IS NOT NULL;
