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
  provider_order_id text UNIQUE,
  payment_instructions jsonb,
  submission_hash text,
  provider_updated_at timestamptz,
  fulfillment text NOT NULL DEFAULT 'awaiting_payment' CHECK (fulfillment IN ('awaiting_payment','awaiting_activation','review_required')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Additive migration from the unactivated Payments API draft; retains any local orders.
ALTER TABLE aperte_sales_orders ADD COLUMN IF NOT EXISTS provider_order_id text;
ALTER TABLE aperte_sales_orders ADD COLUMN IF NOT EXISTS payment_instructions jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS aperte_sales_provider_order ON aperte_sales_orders (provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS aperte_sales_session_created ON aperte_sales_orders (session_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS aperte_sales_pending_activation ON aperte_sales_orders (fulfillment, updated_at DESC);
-- The backend uses a private connection. Public/anonymous roles get no table access.
REVOKE ALL ON aperte_sales_orders FROM PUBLIC;
ALTER TABLE aperte_sales_orders ENABLE ROW LEVEL SECURITY;

-- WhatsApp bot and automatic delivery (lib/whatsapp/store.ts creates the tables on first use).
CREATE TABLE IF NOT EXISTS aperte_wa_contacts (
  sender text PRIMARY KEY, sender_name text NOT NULL DEFAULT '', customer_id text,
  trial_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS aperte_wa_orders (
  order_id uuid PRIMARY KEY, sender text NOT NULL, origin text NOT NULL DEFAULT 'bot', customer_id text,
  claimed_at timestamptz, activated_at timestamptz, notified_at timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS aperte_wa_orders_sender ON aperte_wa_orders (sender, created_at DESC);
CREATE TABLE IF NOT EXISTS aperte_wa_messages (message_id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON aperte_wa_contacts, aperte_wa_orders, aperte_wa_messages FROM PUBLIC;
ALTER TABLE aperte_wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aperte_wa_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE aperte_wa_messages ENABLE ROW LEVEL SECURITY;
