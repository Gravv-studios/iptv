import {database} from '../payments/repository';
import type {SalesOrder} from '../payments/types';

export type Contact = {sender: string; sender_name: string; customer_id: string | null; trial_at: string | null};
export type OrderLink = {order_id: string; sender: string; claimed_at: string | null; activated_at: string | null; notified_at: string | null; error: string | null};
let ready: Promise<unknown> | undefined;
// Additive tables created on first use; the sales table and its constraints stay untouched.
function schema() {
  return ready ??= database().unsafe(`
    CREATE TABLE IF NOT EXISTS aperte_wa_contacts (
      sender text PRIMARY KEY, sender_name text NOT NULL DEFAULT '', customer_id text,
      trial_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS aperte_wa_orders (
      order_id uuid PRIMARY KEY, sender text NOT NULL, claimed_at timestamptz, activated_at timestamptz,
      notified_at timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS aperte_wa_orders_sender ON aperte_wa_orders (sender, created_at DESC);
    REVOKE ALL ON aperte_wa_contacts, aperte_wa_orders FROM PUBLIC;
    ALTER TABLE aperte_wa_contacts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE aperte_wa_orders ENABLE ROW LEVEL SECURITY;`).catch(error => { ready = undefined; throw error; });
}
export async function findContact(sender: string) {
  await schema();
  return (await database()`SELECT * FROM aperte_wa_contacts WHERE sender=${sender}`)[0] as Contact | undefined;
}
// Reserves the single free trial for a sender before the supplier is called, so parallel messages cannot create two.
export async function reserveTrial(sender: string, name: string) {
  await schema();
  const rows = await database()`INSERT INTO aperte_wa_contacts (sender,sender_name,trial_at) VALUES (${sender},${name},now())
    ON CONFLICT (sender) DO UPDATE SET trial_at=now(),sender_name=EXCLUDED.sender_name,updated_at=now()
    WHERE aperte_wa_contacts.trial_at IS NULL AND aperte_wa_contacts.customer_id IS NULL RETURNING *`;
  return rows[0] as Contact | undefined;
}
export async function releaseTrial(sender: string) {
  await database()`UPDATE aperte_wa_contacts SET trial_at=NULL,updated_at=now() WHERE sender=${sender} AND customer_id IS NULL`;
}
export async function saveCustomer(sender: string, name: string, customerId: string) {
  await schema();
  await database()`INSERT INTO aperte_wa_contacts (sender,sender_name,customer_id) VALUES (${sender},${name},${customerId})
    ON CONFLICT (sender) DO UPDATE SET customer_id=EXCLUDED.customer_id,updated_at=now()`;
}
export async function linkOrder(orderId: string, sender: string) {
  await schema();
  await database()`INSERT INTO aperte_wa_orders (order_id,sender) VALUES (${orderId},${sender}) ON CONFLICT (order_id) DO NOTHING`;
}
export async function findLink(orderId: string) {
  await schema();
  return (await database()`SELECT * FROM aperte_wa_orders WHERE order_id=${orderId}`)[0] as OrderLink | undefined;
}
export async function latestOrder(sender: string, planId?: string) {
  await schema();
  const rows = planId
    ? await database()`SELECT o.* FROM aperte_wa_orders w JOIN aperte_sales_orders o ON o.id=w.order_id WHERE w.sender=${sender} AND o.plan_id=${planId} ORDER BY o.created_at DESC LIMIT 1`
    : await database()`SELECT o.* FROM aperte_wa_orders w JOIN aperte_sales_orders o ON o.id=w.order_id WHERE w.sender=${sender} ORDER BY o.created_at DESC LIMIT 1`;
  return rows[0] as SalesOrder | undefined;
}
// One delivery wins. A claim that fails later stays claimed for manual review: retrying could spend credits twice.
export async function claimActivation(orderId: string) {
  const rows = await database()`UPDATE aperte_wa_orders SET claimed_at=now() WHERE order_id=${orderId} AND claimed_at IS NULL RETURNING order_id`;
  return rows.length === 1;
}
export async function markActivated(orderId: string) {
  await database()`UPDATE aperte_wa_orders SET activated_at=now(),error=NULL WHERE order_id=${orderId}`;
}
export async function markFailed(orderId: string, error: string) {
  await database()`UPDATE aperte_wa_orders SET error=${error.slice(0, 300)} WHERE order_id=${orderId}`;
}
export async function claimNotice(orderId: string) {
  const rows = await database()`UPDATE aperte_wa_orders SET notified_at=now() WHERE order_id=${orderId} AND notified_at IS NULL AND activated_at IS NOT NULL RETURNING order_id`;
  return rows.length === 1;
}
