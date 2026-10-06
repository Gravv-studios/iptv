import {CheckoutError, requirePaymentConfig} from '../../../../lib/payments/config';
import {checkOrigin, hash, readJson} from '../../../../lib/payments/security';
import {submissionInput} from '../../../../lib/payments/validation';
import {reserveSubmission} from '../../../../lib/payments/repository';
import {paymentBody, reconcileOrder, submitPayment} from '../../../../lib/payments/mercado-pago';
import {failure, json, ownedOrder} from '../../../../lib/payments/http';
import {publicOrder} from '../../../../lib/payments/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const config = requirePaymentConfig(); checkOrigin(request, config.appUrl);
    const parsed = submissionInput.safeParse(await readJson(request));
    if (!parsed.success) throw new CheckoutError('INVALID_PAYMENT', 400, 'Confira os dados do pagamento.');
    const order = await ownedOrder(request, parsed.data.orderId);
    if (order.mode !== config.mode) throw new CheckoutError('WRONG_MODE', 409, 'Inicie um pedido no ambiente atual.');
    if (order.payment_id) return json({order: publicOrder(await reconcileOrder(order))});
    const body = paymentBody(order, parsed.data, config.appUrl);
    if (body.date_of_expiration && Date.parse(body.date_of_expiration) <= Date.now()) throw new CheckoutError('ORDER_EXPIRED', 409, 'O prazo deste pedido terminou. Inicie um novo pedido.');
    await reserveSubmission(order.id, hash(JSON.stringify(body)));
    return json({order: publicOrder(await submitPayment(order, body))});
  } catch (error) { return failure(error); }
}
