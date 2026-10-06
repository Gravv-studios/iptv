export type PaymentStatus = 'created' | 'pending' | 'in_process' | 'authorized' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back' | 'in_mediation';
export type SalesOrder = {
  id: string; request_key: string; session_hash: string; plan_id: string; plan_name: string;
  period: string; amount_cents: number; customer_name: string; email: string; phone: string;
  mode: 'test' | 'production'; status: PaymentStatus; payment_id: string | null;
  submission_hash: string | null; provider_updated_at: string | null;
  fulfillment: 'awaiting_payment' | 'awaiting_activation' | 'review_required';
  created_at: string; updated_at: string;
};
export type PublicOrder = Pick<SalesOrder, 'id' | 'plan_id' | 'plan_name' | 'period' | 'amount_cents' | 'status' | 'payment_id' | 'mode' | 'fulfillment' | 'created_at'> & {payment_submitted: boolean};
export function publicOrder(order: SalesOrder): PublicOrder {
  const {id, plan_id, plan_name, period, amount_cents, status, payment_id, mode, fulfillment, created_at} = order;
  return {id, plan_id, plan_name, period, amount_cents, status, payment_id, mode, fulfillment, created_at, payment_submitted: !!order.submission_hash};
}
export const paymentLabels: Record<PaymentStatus, string> = {
  created: 'Pedido criado', pending: 'Aguardando pagamento', in_process: 'Pagamento em análise',
  authorized: 'Pagamento em análise', approved: 'Pagamento aprovado', rejected: 'Pagamento não aprovado',
  cancelled: 'Pagamento cancelado ou expirado', refunded: 'Pagamento devolvido',
  charged_back: 'Pagamento contestado', in_mediation: 'Pagamento em revisão',
};
