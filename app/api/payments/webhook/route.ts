import {requirePaymentConfig} from '../../../../lib/payments/config';
import {readJson, verifyNotification} from '../../../../lib/payments/security';
import {findOrder} from '../../../../lib/payments/repository';
import {getProviderOrder, persistVerifiedPayment} from '../../../../lib/payments/mercado-pago';
import {failure, json} from '../../../../lib/payments/http';
import {whatsappConfig} from '../../../../lib/whatsapp/config';
import {fulfillAndNotify} from '../../../../lib/whatsapp/fulfill';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const config = requirePaymentConfig();
    const id = verifyNotification(request, await readJson(request), config.webhookSecret);
    if (!id) return json({error: 'Notificação inválida.'}, 401);
    const payment = await getProviderOrder(id);
    if (!payment.external_reference || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(payment.external_reference)) return json({received: true});
    const order = await findOrder(payment.external_reference);
    if (!order) return json({received: true});
    const updated = await persistVerifiedPayment(order, payment);
    // Orders started in the WhatsApp bot are activated and confirmed here; site orders are left as they were.
    if (updated.status === 'approved' && whatsappConfig().ready) await fulfillAndNotify(updated);
    return json({received: true});
  } catch (error) { return failure(error); }
}
