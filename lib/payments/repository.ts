import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {CheckoutError} from './config';
import {getPlan} from '../domain';
import type {SalesOrder} from './types';
import type {VerifiedOrder} from './validation';

let connection: ReturnType<typeof postgres> | undefined;
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new CheckoutError('PAYMENTS_NOT_CONFIGURED', 503, 'O pagamento online está em ativação.');
  return connection ??= postgres(url, {max: 3, prepare: false, connect_timeout: 5, idle_timeout: 20, ssl: ['localhost', '127.0.0.1'].includes(new URL(url).hostname) ? false : 'require'});
}
export type NewOrder = {requestKey: string; planId: string; customerName: string; email: string; phone: string};
export async function createOrder(input: NewOrder, owner: string, mode: 'test' | 'production') {
  const db = sql();
  return db.begin(async tx => {
    // Serialize starts from the same session so the rate limit also covers parallel requests.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${owner}, 0))`;
    const existing = await tx`SELECT * FROM aperte_sales_orders WHERE request_key=${input.requestKey}`;
    if (existing[0]) {
      const order = existing[0] as SalesOrder;
      if (order.session_hash !== owner) throw new CheckoutError('ORDER_NOT_FOUND', 404, 'Pedido não encontrado.');
      if (order.plan_id !== input.planId || order.email !== input.email || order.phone !== input.phone || order.customer_name !== input.customerName) throw new CheckoutError('ORDER_CONFLICT', 409, 'Esse pedido já foi criado com outros dados.');
      return order;
    }
    const count = await tx`SELECT count(*)::int AS total FROM aperte_sales_orders WHERE session_hash=${owner} AND created_at > now()-interval '10 minutes'`;
    if (count[0].total >= 5) throw new CheckoutError('TOO_MANY_ORDERS', 429, 'Aguarde alguns minutos antes de iniciar outro pedido.');
    const plan = getPlan(input.planId);
    if (!plan) throw new CheckoutError('INVALID_PLAN', 400, 'Escolha um plano disponível.');
    const rows = await tx`INSERT INTO aperte_sales_orders (id,request_key,session_hash,plan_id,plan_name,period,amount_cents,customer_name,email,phone,mode)
      VALUES (${randomUUID()},${input.requestKey},${owner},${plan.id},${plan.name},${plan.period},${plan.amount},${input.customerName},${input.email},${input.phone},${mode}) RETURNING *`;
    return rows[0] as SalesOrder;
  }) as Promise<SalesOrder>;
}
export async function findOrder(id: string, owner?: string) {
  const rows = owner ? await sql()`SELECT * FROM aperte_sales_orders WHERE id=${id} AND session_hash=${owner}` : await sql()`SELECT * FROM aperte_sales_orders WHERE id=${id}`;
  return rows[0] as SalesOrder | undefined;
}
export async function reserveSubmission(id: string, fingerprint: string) {
  const rows = await sql()`UPDATE aperte_sales_orders SET submission_hash=${fingerprint},updated_at=now()
    WHERE id=${id} AND provider_order_id IS NULL AND payment_id IS NULL AND submission_hash IS NULL AND status='created'
    AND created_at > now()-interval '24 hours' RETURNING *`;
  if (!rows[0]) throw new CheckoutError('PAYMENT_ALREADY_SUBMITTED', 409, 'Este pedido já foi enviado ou expirou. Consulte o status antes de tentar outro pagamento.');
  return rows[0] as SalesOrder;
}
export function canApplyPayment(order: SalesOrder, payment: VerifiedOrder) {
  if (order.provider_order_id && order.provider_order_id !== payment.providerId) return false;
  if (order.payment_id && order.payment_id !== payment.id) return false;
  const prior = order.provider_updated_at ? new Date(order.provider_updated_at).getTime() : 0;
  const next = Date.parse(payment.updatedAt);
  if (next < prior) return false;
  if (['refunded','charged_back'].includes(order.status) && !['refunded','charged_back'].includes(payment.status)) return false;
  if (order.status === 'approved' && !['approved','refunded','charged_back','in_mediation'].includes(payment.status)) return false;
  if (order.status === 'in_mediation' && ['created','pending','in_process','authorized'].includes(payment.status)) return false;
  // Equal-timestamp webhook deliveries may repeat, but cannot undo a terminal state.
  if (next === prior && ['rejected','cancelled'].includes(order.status) && !['rejected','cancelled','approved','refunded','charged_back','in_mediation'].includes(payment.status)) return false;
  return true;
}
export async function applyPayment(order: SalesOrder, payment: VerifiedOrder) {
  const fulfillment = payment.refund || ['refunded','charged_back','in_mediation'].includes(payment.status) ? 'review_required' : payment.status === 'approved' ? 'awaiting_activation' : 'awaiting_payment';
  return sql().begin(async tx => {
    const existing = await tx`SELECT * FROM aperte_sales_orders WHERE id=${order.id} FOR UPDATE`;
    const current = existing[0] as SalesOrder | undefined;
    if (!current || !canApplyPayment(current, payment)) return current;
    const finalFulfillment = current.fulfillment === 'review_required' ? 'review_required' : fulfillment;
    const encoded = payment.instructions ? JSON.stringify(payment.instructions) : null;
    const rows = await tx`UPDATE aperte_sales_orders SET provider_order_id=${payment.providerId},payment_id=${payment.id},status=${payment.status},fulfillment=${finalFulfillment},payment_instructions=${encoded}::jsonb,provider_updated_at=${payment.updatedAt},updated_at=now()
      WHERE id=${order.id} RETURNING *`;
    return rows[0] as SalesOrder;
  }) as Promise<SalesOrder | undefined>;
}
export async function rejectInvalidSubmission(id: string, fingerprint: string) {
  const rows = await sql()`UPDATE aperte_sales_orders SET status='rejected',updated_at=now()
    WHERE id=${id} AND submission_hash=${fingerprint} AND provider_order_id IS NULL AND status='created' RETURNING *`;
  return rows[0] as SalesOrder | undefined ?? await findOrder(id);
}
