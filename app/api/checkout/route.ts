import {paymentConfig, requirePaymentConfig, CheckoutError} from '../../../lib/payments/config';
import {checkOrigin, newSessionToken, readJson, sessionCookie, sessionHash, sessionToken} from '../../../lib/payments/security';
import {orderInput} from '../../../lib/payments/validation';
import {createOrder} from '../../../lib/payments/repository';
import {publicOrder} from '../../../lib/payments/types';
import {failure, json} from '../../../lib/payments/http';
import {whatsappConfig} from '../../../lib/whatsapp/config';
import {linkOrder, senderFromPhone} from '../../../lib/whatsapp/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const config = paymentConfig();
  const secure = new URL(request.url).protocol === 'https:' || process.env.VERCEL === '1';
  const headers: Record<string, string> = config.ready && !sessionToken(request) ? {'Set-Cookie': `${sessionCookie}=${newSessionToken()}; HttpOnly; SameSite=Lax; Path=/api/checkout; Max-Age=2592000${secure ? '; Secure' : ''}`} : {};
  return json({ready: config.ready, mode: config.mode, publicKey: config.ready ? config.publicKey : null, methods: ['pix','cards','boleto']}, 200, headers);
}
export async function POST(request: Request) {
  try {
    const config = requirePaymentConfig();
    checkOrigin(request, config.appUrl);
    const parsed = orderInput.safeParse(await readJson(request));
    if (!parsed.success) throw new CheckoutError('INVALID_ORDER', 400, 'Confira o plano, nome, e-mail e WhatsApp.');
    const token = sessionToken(request) ?? newSessionToken();
    const order = await createOrder(parsed.data, sessionHash(token, config.sessionSecret), config.mode);
    // Lets the paid order be activated and the access sent to the WhatsApp typed in the form.
    if (whatsappConfig().ready && order.mode === 'production') await linkOrder(order.id, senderFromPhone(order.phone)).catch(() => console.error('order_link_failed'));
    const secure = new URL(request.url).protocol === 'https:' || process.env.VERCEL === '1';
    return json({order: publicOrder(order)}, 200, {'Set-Cookie': `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/api/checkout; Max-Age=2592000${secure ? '; Secure' : ''}`});
  } catch (error) { return failure(error); }
}
