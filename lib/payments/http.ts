import {CheckoutError, requirePaymentConfig} from './config';
import {sessionHash, sessionToken} from './security';
import {findOrder} from './repository';
export const json = (data: unknown, status = 200, headers: HeadersInit = {}) => Response.json(data, {status, headers: {'Cache-Control': 'no-store', ...headers}});
export function failure(error: unknown) {
  if (error instanceof CheckoutError) return json({code: error.code, error: error.message}, error.status);
  // Never put payer data, database URLs, access tokens or SDK responses in logs/errors.
  console.error('checkout_unavailable');
  return json({code: 'CHECKOUT_UNAVAILABLE', error: 'Não foi possível concluir agora. Consulte o pedido antes de tentar outro pagamento.'}, 503);
}
export async function ownedOrder(request: Request, id: string) {
  const config = requirePaymentConfig();
  const token = sessionToken(request);
  if (!token || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) throw new CheckoutError('ORDER_NOT_FOUND', 404, 'Pedido não encontrado neste navegador.');
  const order = await findOrder(id, sessionHash(token, config.sessionSecret));
  if (!order) throw new CheckoutError('ORDER_NOT_FOUND', 404, 'Pedido não encontrado neste navegador.');
  return order;
}
