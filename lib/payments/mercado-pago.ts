import {MercadoPagoConfig, Order, User, MPBadRequestError} from 'mercadopago';
import type {CreateOrderRequest} from 'mercadopago/dist/clients/order/create/types';
import type {OrderResponse} from 'mercadopago/dist/clients/order/commonTypes';
import type {UserResponse} from 'mercadopago/dist/clients/user/get/types';
import type {z} from 'zod';
import {CheckoutError, requirePaymentConfig} from './config';
import type {SalesOrder} from './types';
import {submissionInput, validateMethod, verifiedProviderOrder} from './validation';
import {applyPayment, rejectInvalidSubmission} from './repository';
import {hash} from './security';

function client() { return new MercadoPagoConfig({accessToken: requirePaymentConfig().accessToken, options: {timeout: 8000, maxRetries: 0}}); }
function orders() { return new Order(client()); }
type Account = {id: string; mode: 'test' | 'production'};
let accountCache: {key: string; expires: number; account: Account} | undefined;
export function verifiedAccount(user: UserResponse, config: {collectorId: string; mode: 'test' | 'production'}): Account {
  // Orders has no live_mode field. Verify the account behind the authenticated
  // token; each provider order must belong to this same user_id and environment.
  const mode = user.tags?.includes('test_user') ? 'test' : 'production';
  if (String(user.id) !== config.collectorId || user.site_id !== 'MLB' || !Array.isArray(user.tags) || mode !== config.mode) {
    throw new CheckoutError('PAYMENT_ACCOUNT_MISMATCH', 503, 'O recebimento está em configuração. Nenhuma nova cobrança foi enviada.');
  }
  return {id: String(user.id), mode};
}
export async function getVerifiedAccount() {
  const config = requirePaymentConfig();
  const key = hash(`${config.accessToken}:${config.collectorId}:${config.mode}`);
  if (accountCache?.key === key && accountCache.expires > Date.now()) return accountCache.account;
  const account = verifiedAccount(await new User(client()).get(), config);
  accountCache = {key, expires: Date.now() + 5 * 60000, account};
  return account;
}
export function paymentBody(order: SalesOrder, input: z.infer<typeof submissionInput>): CreateOrderRequest {
  validateMethod(input);
  const {payment_method_id, payer, token} = input.formData;
  const parts = order.customer_name.trim().split(/\s+/);
  const amount = (order.amount_cents / 100).toFixed(2);
  const isPix = input.selectedPaymentMethod === 'bank_transfer';
  const isBoleto = input.selectedPaymentMethod === 'ticket';
  const type = isPix ? 'bank_transfer' : isBoleto ? 'ticket' : ({creditCard: 'credit_card', debitCard: 'debit_card', prepaidCard: 'prepaid_card'} as const)[input.selectedPaymentMethod as 'creditCard' | 'debitCard' | 'prepaidCard'];
  const address = payer.address;
  return {
    type: 'online', processing_mode: 'automatic', total_amount: amount,
    external_reference: order.id, description: `${order.plan_name} · ${order.period}`,
    transactions: {payments: [{amount, payment_method: {id: isBoleto ? 'boleto' : payment_method_id, type,
      ...(!isPix && !isBoleto ? {token, installments: 1} : {})},
      // Relative to provider issuance, not the potentially old local cart.
      ...(isPix ? {expiration_time: 'PT30M'} : isBoleto ? {expiration_time: 'P3D'} : {}),
    }]},
    payer: {email: order.email, first_name: payer.first_name || parts[0], last_name: payer.last_name || parts.slice(1).join(' '), identification: payer.identification,
      ...(isBoleto && address ? {address: {zip_code: address.zip_code, street_name: address.street_name, street_number: address.street_number, neighborhood: address.neighborhood, city: address.city, state: address.state || address.federal_unit}} : {}),
    },
    items: [{external_code: order.plan_id, title: order.plan_name, description: order.period, quantity: 1, unit_price: amount}],
  };
}
export async function persistVerifiedPayment(order: SalesOrder, response: OrderResponse) {
  const validated = verifiedProviderOrder(order, response, await getVerifiedAccount());
  return await applyPayment(order, validated) ?? order;
}
const preCreationErrors = new Set(['json_syntax_error','required_properties','unsupported_properties','minimum_properties','minimum_items','maximum_items','invalid_properties','property_type','property_value','empty_required_header','invalid_idempotency_key_length','order_builder_without_transactions','invalid_order_mode_for_operation','invalid_order_type','exceeded_number_of_transactions','invalid_email_for_sandbox','invalid_total_amount']);
export function isDefinitiveValidationError(error: unknown) {
  if (!(error instanceof MPBadRequestError) || error.status !== 400) return false;
  const codes = [error.error, ...error.causes.map(c => typeof c === 'object' && c !== null ? String((c as {code?: unknown}).code ?? '') : '')].filter(code => !!code && code !== 'bad_request');
  return codes.length > 0 && codes.every(code => preCreationErrors.has(code));
}
export async function createProviderOrder(body: CreateOrderRequest, idempotencyKey: string): Promise<Pick<OrderResponse, 'id'>> {
  // SDK 3.6.1 drops Orders' errors[] and the order id on non-2xx responses.
  // Keep only error codes here, and preserve a 402 order id for authoritative GET.
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${requirePaymentConfig().accessToken}`, 'X-Idempotency-Key': idempotencyKey},
    body: JSON.stringify(body), signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
  });
  const raw: unknown = await response.json();
  const result = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (response.ok || (response.status === 402 && typeof result.id === 'string' && /^ORD[A-Z0-9]{20,40}$/.test(result.id))) return {id: typeof result.id === 'string' ? result.id : undefined};
  if (response.status === 400) {
    const errors = Array.isArray(result.errors) ? result.errors : Array.isArray(result.cause) ? result.cause : [];
    const codes = [result.error, result.code, ...errors.map(item => item && typeof item === 'object' ? (item as {code?: unknown}).code : undefined)]
      .filter((code): code is string => typeof code === 'string' && /^[a-z_]{1,80}$/.test(code));
    throw new MPBadRequestError({status: 400, error: codes[0] ?? 'unknown_error', cause: codes.slice(1).map(code => ({code}))});
  }
  throw new CheckoutError('PAYMENT_CONFIRMATION_PENDING', 503, 'A confirmação do pedido está pendente. Consulte o status antes de iniciar outro pagamento.');
}
export async function submitPayment(order: SalesOrder, body: CreateOrderRequest) {
  await getVerifiedAccount();
  let response: Pick<OrderResponse, 'id'>;
  try {
    // Immutable UUID and no SDK retries. Never persist card tokens or invent a
    // replacement transaction to recover an ambiguous response.
    response = await createProviderOrder(body, order.id);
  } catch (error) {
    if (isDefinitiveValidationError(error)) return await rejectInvalidSubmission(order.id, hash(JSON.stringify(body))) ?? order;
    throw error;
  }
  if (!response.id || !/^ORD[A-Z0-9]{20,40}$/.test(response.id)) throw new CheckoutError('PAYMENT_REVIEW_REQUIRED', 409, 'O pedido está em conferência. Aguarde a atualização antes de iniciar outro pagamento.');
  // GET supplies the full representation, including seller and timestamps
  // sometimes absent in asynchronous create responses.
  return persistVerifiedPayment(order, await getProviderOrder(response.id));
}
export async function getProviderOrder(id: string) {
  if (!/^ORD[A-Z0-9]{20,40}$/.test(id)) throw new CheckoutError('INVALID_PROVIDER_ORDER', 400, 'Identificador de pedido inválido.');
  return orders().get({id});
}
export async function reconcileOrder(order: SalesOrder) {
  if (!order.submission_hash) return order;
  const config = requirePaymentConfig();
  if (order.mode !== config.mode) throw new CheckoutError('WRONG_MODE', 409, 'Este pedido pertence a outro ambiente de pagamento.');
  await getVerifiedAccount();
  if (order.provider_order_id) return persistVerifiedPayment(order, await getProviderOrder(order.provider_order_id));
  if (order.status === 'rejected') return order;
  // Documented GET /v1/orders search. An empty result is NOT proof of no charge.
  // Signed order webhooks can also recover a lost creation response.
  const result = await orders().search({options: {begin_date: new Date(order.created_at).toISOString(), end_date: new Date().toISOString(), external_reference: order.id, type: 'online', page: 1, page_size: 2}});
  const matches = result.data ?? [];
  if (!matches.length) return order;
  if (matches.length !== 1 || Number(result.paging?.total ?? matches.length) !== 1 || !matches[0].id) throw new CheckoutError('PAYMENT_REVIEW_REQUIRED', 409, 'O pedido precisa de conferência pelo atendimento.');
  return persistVerifiedPayment(order, await getProviderOrder(matches[0].id));
}
