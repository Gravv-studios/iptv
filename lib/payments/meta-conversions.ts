import {createHash} from 'node:crypto';
import {database} from './repository';
import type {SalesOrder} from './types';

export type Attribution = {consent: true; fbp?: string; fbc?: string};
export const purchaseEventId = (id: string) => `purchase_${id}`;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function metaConfig() {
  return {enabled: process.env.META_TRACKING_ENABLED === 'true', pixelId: process.env.META_PIXEL_ID ?? '',
    token: process.env.META_CAPI_ACCESS_TOKEN ?? '', version: process.env.META_GRAPH_VERSION ?? 'v25.0'};
}
let schemaReady: Promise<unknown> | undefined;
async function schema() {
  return schemaReady ??= database().unsafe(`CREATE TABLE IF NOT EXISTS aperte_meta_purchases (
    order_id uuid PRIMARY KEY REFERENCES aperte_sales_orders(id), attribution jsonb NOT NULL,
    user_agent text, consent_at timestamptz NOT NULL DEFAULT now(), event_time bigint,
    claimed_at timestamptz, sent_at timestamptz, attempts integer NOT NULL DEFAULT 0);
    REVOKE ALL ON aperte_meta_purchases FROM PUBLIC;
    ALTER TABLE aperte_meta_purchases ENABLE ROW LEVEL SECURITY;`).catch(error => {schemaReady = undefined; throw error;});
}
export async function saveAttribution(order: SalesOrder, attribution: Attribution | undefined, request: Request) {
  if (!metaConfig().enabled || order.mode !== 'production' || !attribution?.consent) return;
  await schema();
  const db = database();
  await db`INSERT INTO aperte_meta_purchases(order_id,attribution,user_agent)
    VALUES (${order.id},${db.json(attribution)},${(request.headers.get('user-agent') ?? '').slice(0,500)})
    ON CONFLICT (order_id) DO NOTHING`;
}
export async function revokeAttribution(owner: string) {
  if(!metaConfig().enabled) return;
  await schema();
  await database()`DELETE FROM aperte_meta_purchases m USING aperte_sales_orders o WHERE m.order_id=o.id AND o.session_hash=${owner}`;
}
export function purchasePayload(order: SalesOrder, attribution: Attribution, userAgent: string, eventTime: number) {
  if (order.mode !== 'production' || order.status !== 'approved' || !attribution.consent) return null;
  const phone = order.phone.replace(/\D/g,'');
  return {event_name: 'Purchase', event_id: purchaseEventId(order.id), event_time: eventTime,
    action_source: 'website', event_source_url: 'https://www.aperteoplayiptv.com.br/comprar',
    user_data: {em: [digest(order.email.trim().toLowerCase())], ph: [digest(phone.length <= 11 ? '55' + phone : phone)],
      ...(userAgent ? {client_user_agent: userAgent} : {}), ...(attribution.fbp ? {fbp: attribution.fbp} : {}), ...(attribution.fbc ? {fbc: attribution.fbc} : {})},
    custom_data: {currency: 'BRL', value: order.amount_cents / 100, content_ids: [order.plan_id], content_type: 'product', num_items: 1}};
}
// Called only after provider verification. Retry on subsequent verified webhooks/status checks;
// atomic lease prevents concurrent sends and the immutable event id deduplicates timeout retries.
export async function sendPurchase(order: SalesOrder) {
  const config = metaConfig();
  if (!config.enabled || !/^\d+$/.test(config.pixelId) || !config.token || !/^v\d+\.\d+$/.test(config.version) || order.status !== 'approved' || order.mode !== 'production') return;
  await schema();
  const db = database();
  const rows = await db`UPDATE aperte_meta_purchases SET claimed_at=now(),attempts=attempts+1,
    event_time=COALESCE(event_time,${Math.floor(Date.now()/1000)})
    WHERE order_id=${order.id} AND sent_at IS NULL AND (claimed_at IS NULL OR claimed_at < now()-interval '2 minutes')
    AND consent_at > now()-interval '90 days' AND (event_time IS NULL OR event_time > extract(epoch from now()-interval '6 days')) RETURNING *`;
  if (!rows[0]) return;
  const row = rows[0];
  const payload = purchasePayload(order, row.attribution as Attribution, String(row.user_agent ?? ''), Number(row.event_time));
  if (!payload) return;
  try {
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.pixelId}/events`, {
      method: 'POST', headers: {'Content-Type':'application/json', Authorization: `Bearer ${config.token}`},
      body: JSON.stringify({data:[payload]}), signal: AbortSignal.timeout(5000), redirect:'error', cache:'no-store'});
    const result = await response.json() as {events_received?: number};
    if (!response.ok || result.events_received !== 1) throw new Error('meta_event_rejected');
    await db`UPDATE aperte_meta_purchases SET sent_at=now(),claimed_at=NULL WHERE order_id=${order.id}`;
  } catch {
    await db`UPDATE aperte_meta_purchases SET claimed_at=NULL WHERE order_id=${order.id}`;
    console.error('meta_purchase_pending'); // Never log tokens, customer data or provider response.
  }
}
