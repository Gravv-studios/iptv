import {z} from 'zod';
import {CheckoutError} from './config';
import type {SalesOrder, PaymentStatus} from './types';
import type {PaymentResponse} from 'mercadopago/dist/clients/payment/commonTypes';

export const orderInput = z.object({
  requestKey: z.string().uuid(), planId: z.enum(['mensal','semestral','anual']),
  customerName: z.string().trim().min(3).max(100), email: z.string().trim().email().max(200).transform(s => s.toLowerCase()),
  phone: z.string().transform(s => s.replace(/\D/g, '')).refine(s => /^\d{10,13}$/.test(s)),
}).strict();
const address = z.object({zip_code: z.string().regex(/^\d{8}$/), street_name: z.string().min(1).max(150), street_number: z.string().min(1).max(20), neighborhood: z.string().min(1).max(100), city: z.string().min(1).max(100), federal_unit: z.string().length(2)});
export const submissionInput = z.object({
  orderId: z.string().uuid(),
  selectedPaymentMethod: z.enum(['bank_transfer','ticket','creditCard','debitCard','prepaidCard']),
  formData: z.object({
    payment_method_id: z.string().regex(/^[a-zA-Z0-9_]{2,40}$/),
    token: z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/).optional(),
    installments: z.number().int().min(1).max(1).optional(),
    issuer_id: z.union([z.string().regex(/^\d+$/),z.number().int().positive()]).optional(),
    payer: z.object({
      email: z.string().email().max(200).optional(),
      identification: z.object({type: z.enum(['CPF','CNPJ']),number: z.string().regex(/^\d{11}(\d{3})?$/)}),
      first_name: z.string().max(100).optional(), last_name: z.string().max(100).optional(), address: address.optional(),
    }),
  }),
});
export function validateMethod(data: z.infer<typeof submissionInput>) {
  const method = data.formData.payment_method_id;
  if (data.selectedPaymentMethod === 'bank_transfer' && method === 'pix') return;
  if (data.selectedPaymentMethod === 'ticket' && method === 'bolbradesco' && data.formData.payer.address) return;
  if (['creditCard','debitCard','prepaidCard'].includes(data.selectedPaymentMethod) && data.formData.token && !['pix','bolbradesco','account_money'].includes(method)) return;
  throw new CheckoutError('INVALID_PAYMENT_METHOD', 400, 'Escolha um meio de pagamento disponível e confira os dados.');
}
export function verifiedPayment(order: SalesOrder, payment: PaymentResponse, collectorId: string) {
  const metadata = payment.metadata as Record<string, unknown> | undefined;
  const id = String(payment.id ?? '');
  const statuses: PaymentStatus[] = ['pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back','in_mediation'];
  if (!/^\d+$/.test(id) || payment.external_reference !== order.id || metadata?.order_id !== order.id ||
      metadata?.plan_id !== order.plan_id || metadata?.app !== 'aperte-play' ||
      Math.round(Number(payment.transaction_amount) * 100) !== order.amount_cents || payment.currency_id !== 'BRL' ||
      String(payment.collector_id) !== collectorId || payment.live_mode !== (order.mode === 'production') ||
      (order.payment_id && order.payment_id !== id) || !statuses.includes(payment.status as PaymentStatus) ||
      !payment.date_last_updated || !Number.isFinite(Date.parse(payment.date_last_updated))) {
    throw new CheckoutError('PAYMENT_MISMATCH', 409, 'O pagamento está em verificação. Fale com o atendimento informando o número do pedido.');
  }
  return {id, status: payment.status as PaymentStatus, updatedAt: payment.date_last_updated, refund: Number(payment.transaction_amount_refunded ?? 0) > 0};
}
