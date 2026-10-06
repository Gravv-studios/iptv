-- Apply once to a PostgreSQL database dedicated to Aperte Play. No demo data is migrated.
CREATE TABLE IF NOT EXISTS aperte_sales_orders (
  id uuid PRIMARY KEY,
  request_key uuid NOT NULL UNIQUE,
  session_hash text NOT NULL,
  plan_id text NOT NULL CHECK (plan_id IN ('mensal','semestral','anual')),
  plan_name text NOT NULL,
  period text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('test','production')),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back','in_mediation')),
  payment_id text UNIQUE,
  submission_hash text,
  provider_updated_at timestamptz,
  fulfillment text NOT NULL DEFAULT 'awaiting_payment' CHECK (fulfillment IN ('awaiting_payment','awaiting_activation','review_required')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aperte_sales_session_created ON aperte_sales_orders (session_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS aperte_sales_pending_activation ON aperte_sales_orders (fulfillment, updated_at DESC);
-- The backend uses a private connection. Public/anonymous roles get no table access.
REVOKE ALL ON aperte_sales_orders FROM PUBLIC;
ALTER TABLE aperte_sales_orders ENABLE ROW LEVEL SECURITY;
