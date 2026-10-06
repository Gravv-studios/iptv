import {MercadoPagoConfig, Payment} from 'mercadopago';
import type {PaymentCreateRequest} from 'mercadopago/dist/clients/payment/create/types';
import type {PaymentResponse} from 'mercadopago/dist/clients/payment/commonTypes';
import type {z} from 'zod';
import {CheckoutError, requirePaymentConfig} from './config';
import type {SalesOrder} from './types';
import {submissionInput, validateMethod, verifiedPayment} from './validation';
import {applyPayment} from './repository';

function payments() { return new Payment(new MercadoPagoConfig({accessToken: requirePaymentConfig().accessToken, options: {timeout: 8000, maxRetries: 0}})); }
export function paymentBody(order: SalesOrder, input: z.infer<typeof submissionInput>, appUrl: string): PaymentCreateRequest {
  validateMethod(input);
  const {payment_method_id, payer, token, issuer_id} = input.formData;
  const parts = order.customer_name.trim().split(/\s+/);
  const expires = new Date(Date.parse(order.created_at) + (payment_method_id === 'pix' ? 30 * 60000 : 24 * 3600000)).toISOString();
  return {
    transaction_amount: order.amount_cents / 100, description: `${order.plan_name} · ${order.period}`,
    payment_method_id, ...(token ? {token, installments: 1, ...(issuer_id ? {issuer_id: Number(issuer_id)} : {})} : {date_of_expiration: expires}),
    external_reference: order.id, notification_url: `${appUrl}/api/payments/webhook`,
    metadata: {app: 'aperte-play', order_id: order.id, plan_id: order.plan_id},
    payer: {email: order.email, first_name: payer.first_name || parts[0], last_name: payer.last_name || parts.slice(1).join(' '), identification: payer.identification, ...(payer.address ? {address: payer.address} : {})},
    additional_info: {items: [{id: order.plan_id, title: order.plan_name, description: order.period, quantity: 1, unit_price: order.amount_cents / 100}]},
  };
}
export async function persistVerifiedPayment(order: SalesOrder, payment: PaymentResponse) {
  const validated = verifiedPayment(order, payment, requirePaymentConfig().collectorId);
  return await applyPayment(order, validated) ?? order;
}
export async function submitPayment(order: SalesOrder, body: PaymentCreateRequest) {
  const payment = await payments().create({body, requestOptions: {idempotencyKey: order.id}});
  return persistVerifiedPayment(order, payment);
}
export async function getProviderPayment(id: string) { return payments().get({id}); }
export async function reconcileOrder(order: SalesOrder) {
  if (order.payment_id) return persistVerifiedPayment(order, await getProviderPayment(order.payment_id));
  if (!order.submission_hash) return order;
  // Recover when the provider received the charge but our response/database update timed out.
  const result = await payments().search({options: {external_reference: order.id, limit: 5}});
  const matches = result.results ?? [];
  if (!matches.length) return order;
  if (matches.length !== 1 || !matches[0].id) throw new CheckoutError('PAYMENT_REVIEW_REQUIRED', 409, 'O pedido precisa de conferência pelo atendimento.');
  return persistVerifiedPayment(order, await getProviderPayment(String(matches[0].id)));
}
