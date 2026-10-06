import {requirePaymentConfig} from '../../../../lib/payments/config';
import {readJson, verifyNotification} from '../../../../lib/payments/security';
import {findOrder} from '../../../../lib/payments/repository';
import {getProviderPayment, persistVerifiedPayment} from '../../../../lib/payments/mercado-pago';
import {failure, json} from '../../../../lib/payments/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const config = requirePaymentConfig();
    const id = verifyNotification(request, await readJson(request), config.webhookSecret);
    if (!id) return json({error: 'Notificação inválida.'}, 401);
    const payment = await getProviderPayment(id);
    if (!payment.external_reference || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(payment.external_reference)) return json({received: true});
    const order = await findOrder(payment.external_reference);
    if (!order) return json({received: true});
    await persistVerifiedPayment(order, payment);
    return json({received: true});
  } catch (error) { return failure(error); }
}
