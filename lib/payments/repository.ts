import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {CheckoutError} from './config';
import {getPlan} from '../domain';
import type {SalesOrder, PaymentStatus} from './types';

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
    WHERE id=${id} AND payment_id IS NULL AND (submission_hash IS NULL OR submission_hash=${fingerprint}) AND status='created'
    AND created_at > now()-interval '24 hours' RETURNING *`;
  if (!rows[0]) throw new CheckoutError('PAYMENT_ALREADY_SUBMITTED', 409, 'Este pedido já foi enviado ou expirou. Consulte o status antes de tentar outro pagamento.');
  return rows[0] as SalesOrder;
}
export async function applyPayment(order: SalesOrder, payment: {id: string; status: PaymentStatus; updatedAt: string; refund: boolean}) {
  const fulfillment = payment.refund || ['refunded','charged_back','in_mediation'].includes(payment.status) ? 'review_required' : payment.status === 'approved' ? 'awaiting_activation' : 'awaiting_payment';
  const rows = await sql()`UPDATE aperte_sales_orders SET payment_id=${payment.id},status=${payment.status},fulfillment=${fulfillment},provider_updated_at=${payment.updatedAt},updated_at=now()
    WHERE id=${order.id} AND (payment_id IS NULL OR payment_id=${payment.id})
      AND (provider_updated_at IS NULL OR provider_updated_at <= ${payment.updatedAt}::timestamptz)
      AND NOT (status IN ('refunded','charged_back') AND ${payment.status} NOT IN ('refunded','charged_back'))
    RETURNING *`;
  return rows[0] as SalesOrder | undefined ?? await findOrder(order.id);
}
