import {z} from 'zod';
import {CheckoutError} from './config';
import type {SalesOrder, PaymentStatus, PaymentInstructions} from './types';
import type {OrderResponse} from 'mercadopago/dist/clients/order/commonTypes';

export const orderInput = z.object({
  requestKey: z.string().uuid(), planId: z.enum(['mensal','semestral','anual']),
  customerName: z.string().trim().min(3).max(100), email: z.string().trim().email().max(200).transform(s => s.toLowerCase()),
  phone: z.string().transform(s => s.replace(/\D/g, '')).refine(s => /^\d{10,13}$/.test(s)),
}).strict();
const address = z.object({zip_code: z.string().regex(/^\d{8}$/), street_name: z.string().trim().min(1).max(150), street_number: z.string().trim().min(1).max(20), neighborhood: z.string().trim().min(1).max(100), city: z.string().trim().min(1).max(100), federal_unit: z.string().regex(/^[A-Z]{2}$/).optional(), state: z.string().regex(/^[A-Z]{2}$/).optional()}).refine(a => !!(a.state || a.federal_unit));
const cardType = z.enum(['credit_card','debit_card','prepaid_card']);
export const submissionInput = z.object({
  orderId: z.string().uuid(),
  selectedPaymentMethod: z.enum(['bank_transfer','ticket','creditCard','debitCard','prepaidCard']),
  paymentTypeId: cardType.optional(),
  formData: z.object({
    payment_method_id: z.string().regex(/^[a-zA-Z0-9_]{2,40}$/),
    token: z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/).optional(),
    installments: z.number().int().min(1).max(1).optional(),
    issuer_id: z.union([z.string().regex(/^\d+$/),z.number().int().positive()]).optional(),
    paymentTypeId: cardType.optional(),
    payer: z.object({
      email: z.string().email().max(200).optional(),
      identification: z.object({type: z.enum(['CPF','CNPJ']),number: z.string().regex(/^\d{11}(\d{3})?$/)}).refine(i => i.number.length === (i.type === 'CPF' ? 11 : 14)),
      first_name: z.string().max(100).optional(), last_name: z.string().max(100).optional(), address: address.optional(),
    }),
  }),
});
export function validateMethod(data: z.infer<typeof submissionInput>) {
  const method = data.formData.payment_method_id;
  if (data.selectedPaymentMethod === 'bank_transfer' && method === 'pix') return;
  if (data.selectedPaymentMethod === 'ticket' && ['boleto','bolbradesco'].includes(method) && data.formData.payer.address) return;
  const types = {creditCard: 'credit_card', debitCard: 'debit_card', prepaidCard: 'prepaid_card'} as const;
  const expected = types[data.selectedPaymentMethod as keyof typeof types];
  const supplied = data.paymentTypeId ?? data.formData.paymentTypeId;
  if (expected && (!supplied || supplied === expected) && data.formData.token && !['pix','boleto','bolbradesco','account_money'].includes(method)) return;
  throw new CheckoutError('INVALID_PAYMENT_METHOD', 400, 'Escolha um meio de pagamento disponível e confira os dados.');
}
const mismatch = () => new CheckoutError('PAYMENT_MISMATCH', 409, 'O pagamento está em verificação. Fale com o atendimento informando o número do pedido.');
export function cents(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,10}(\.\d{1,2})?$/.test(value)) return NaN;
  const [whole, decimal = ''] = value.split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
export function safeTicketUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['www.mercadopago.com.br','mercadopago.com.br','www.mercadopago.com','mercadopago.com','www.mercadopago.com.ar','mercadopago.com.ar'].includes(url.hostname) ? url.href : undefined;
  } catch { return undefined; }
}
function instructions(payment: NonNullable<NonNullable<OrderResponse['transactions']>['payments']>[number]): PaymentInstructions | null {
  const method = payment.payment_method;
  if (!method || !['pix','boleto','bolbradesco'].includes(method.id ?? '')) return null;
  const result: PaymentInstructions = {kind: method.id === 'pix' ? 'pix' : 'boleto'};
  const ticketUrl = safeTicketUrl(method.ticket_url);
  if (ticketUrl) result.ticketUrl = ticketUrl;
  if (method.id === 'pix') {
    if (typeof method.qr_code === 'string' && method.qr_code.length <= 4096 && /^[\x20-\x7E]+$/.test(method.qr_code)) result.qrCode = method.qr_code;
    const base64 = method.qr_code_base64;
    // Only a bounded, bare PNG payload; never provider-supplied HTML/SVG/data URLs.
    if (typeof base64 === 'string' && base64.length <= 200000 && base64.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) result.qrCodeBase64 = base64;
    }
  } else {
    const barcode = method.digitable_line ?? method.barcode_content;
    if (typeof barcode === 'string' && /^[\d .-]{40,100}$/.test(barcode)) result.barcode = barcode;
  }
  if (payment.date_of_expiration && Number.isFinite(Date.parse(payment.date_of_expiration))) result.expiresAt = new Date(payment.date_of_expiration).toISOString();
  return result;
}
export type VerifiedOrder = {providerId: string; id: string | null; status: PaymentStatus; updatedAt: string; refund: boolean; instructions: PaymentInstructions | null};
export function verifiedProviderOrder(order: SalesOrder, response: OrderResponse, account: {id: string; mode: 'test' | 'production'}): VerifiedOrder {
  const id = response.id ?? '';
  const payments = response.transactions?.payments ?? [];
  if (!/^ORD[A-Z0-9]{20,40}$/.test(id) || response.type !== 'online' || response.external_reference !== order.id ||
    response.country_code !== 'BRA' || (response.currency !== undefined && response.currency !== 'BRL') ||
    cents(response.total_amount) !== order.amount_cents || String(response.user_id) !== account.id || account.mode !== order.mode ||
    (order.provider_order_id && order.provider_order_id !== id) || !order.submission_hash ||
    !response.last_updated_date || !Number.isFinite(Date.parse(response.last_updated_date)) || payments.length > 1) throw mismatch();
  const base = {providerId: id, updatedAt: response.last_updated_date, refund: false, instructions: null};
  // An asynchronous Orders response can precede its transaction. It never proves payment.
  if (payments.length === 0 && ['created','processing','in_review'].includes(response.status ?? '') && !order.payment_id) return {...base, id: null, status: 'in_process'};
  const payment = payments[0];
  if (!payment || !/^PAY[A-Z0-9]{20,40}$/.test(payment.id ?? '') || cents(payment.amount) !== order.amount_cents || (order.payment_id && order.payment_id !== payment.id)) throw mismatch();
  let status: PaymentStatus;
  const refund = cents(payment.refunded_amount ?? '0') > 0 || response.status_detail === 'partially_refunded' || payment.status_detail === 'partially_refunded' || !!response.transactions?.refunds?.length;
  if (response.status === 'charged_back' || payment.status === 'charged_back' || response.transactions?.chargebacks?.length) status = 'charged_back';
  else if (response.status === 'refunded' || payment.status === 'refunded') status = 'refunded';
  else if (refund) status = 'in_mediation';
  else if (response.status === 'processed' && response.status_detail === 'accredited' && payment.status === 'processed' && payment.status_detail === 'accredited' && cents(payment.paid_amount) === order.amount_cents && cents(response.total_paid_amount) === order.amount_cents) status = 'approved';
  else if (response.status === 'processed' || payment.status === 'processed') throw mismatch();
  else if (['failed'].includes(response.status ?? '') && payment.status === 'failed') status = 'rejected';
  else if (['canceled','expired'].includes(response.status ?? '') && ['canceled','expired'].includes(payment.status ?? '')) status = 'cancelled';
  else if (['created','processing','in_review','action_required'].includes(response.status ?? '') && ['created','processing','in_review','action_required'].includes(payment.status ?? '')) {
    status = payment.status_detail === 'waiting_capture' ? 'authorized' : ['waiting_payment','waiting_transfer'].includes(payment.status_detail ?? '') ? 'pending' : 'in_process';
  } else throw mismatch();
  return {...base, id: payment.id!, status, refund, instructions: status === 'pending' ? instructions(payment) : null};
}
