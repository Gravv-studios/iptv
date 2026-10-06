import {createHash, createHmac, randomBytes} from 'node:crypto';
import {WebhookSignatureValidator} from 'mercadopago';
import {CheckoutError} from './config';

export const sessionCookie = 'aperte_payments';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function sessionToken(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export const newSessionToken = () => randomBytes(32).toString('hex');
export const sessionHash = (token: string, secret: string) => createHmac('sha256', secret).update(token).digest('hex');
export function checkOrigin(request: Request, appUrl: string) {
  const expected = process.env.VERCEL === '1' ? new URL(appUrl).origin : new URL(request.url).origin;
  if (request.headers.get('origin') !== expected) throw new CheckoutError('ORIGIN_REJECTED', 403, 'Atualize a página para continuar.');
}
export async function readJson(request: Request, limit = 12000) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new CheckoutError('INVALID_CONTENT_TYPE', 415, 'Envie os dados no formato correto.');
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new CheckoutError('BODY_TOO_LARGE', 413, 'Dados muito extensos.');
  const reader = request.body?.getReader();
  let data = '', size = 0;
  if (reader) {
    const decoder = new TextDecoder();
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new CheckoutError('BODY_TOO_LARGE', 413, 'Dados muito extensos.'); }
      data += decoder.decode(value, {stream: true});
    }
    data += decoder.decode();
  }
  try { return JSON.parse(data) as unknown; } catch { throw new CheckoutError('INVALID_JSON', 400, 'Confira os dados e tente novamente.'); }
}
export function verifyNotification(request: Request, body: unknown, secret: string) {
  const id = new URL(request.url).searchParams.get('data.id');
  const payload = body as {type?: string; data?: {id?: unknown}} | null;
  if (!id || !/^ORD[A-Z0-9]{20,40}$/i.test(id) || !request.headers.get('x-request-id') || payload?.type !== 'order' || String(payload?.data?.id).toLowerCase() !== id.toLowerCase()) return null;
  try {
    WebhookSignatureValidator.validate({xSignature: request.headers.get('x-signature') ?? '', xRequestId: request.headers.get('x-request-id') ?? '', dataId: id.toLowerCase(), secret});
    return id.toUpperCase();
  } catch { return null; }
}
