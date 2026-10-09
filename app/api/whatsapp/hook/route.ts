import {timingSafeEqual} from 'node:crypto';
import {after} from 'next/server';
import {CheckoutError} from '../../../../lib/payments/config';
import {json} from '../../../../lib/payments/http';
import {hash, readJson} from '../../../../lib/payments/security';
import {answer, parseHook} from '../../../../lib/whatsapp/bot';
import {whatsappConfig} from '../../../../lib/whatsapp/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// BotBot device webhook: every incoming message, with the sender's number (the chatbot URL reply omits it).
// The shared secret in the URL is the only caller authentication BotBot offers.
export async function POST(request: Request) {
  const config = whatsappConfig();
  const key = new URL(request.url).searchParams.get('k') ?? '';
  if (!config.ready || !config.canSend || !timingSafeEqual(Buffer.from(hash(key)), Buffer.from(hash(config.secret)))) return json({error: 'Não autorizado.'}, 401);
  // Off by default: BotBot also posts the messages the bot itself sends, with the customer's number as sender,
  // and answering them looped on 09/10/2026. Do not enable before outgoing messages can be told apart.
  if (process.env.WHATSAPP_HOOK_ENABLED !== 'true') return json({received: true});
  let body: unknown;
  try { body = await readJson(request, 60000); } catch { return json({received: true}); }
  const message = parseHook(body);
  if (!message && body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    // Event and type names only, to learn which notifications BotBot sends.
    console.info('whatsapp_hook_ignored', `event:${String(data.event).slice(0, 20)} type:${String(data.messageType).slice(0, 20)}`);
  }
  // Answer BotBot at once; it disables webhooks that fail or stall repeatedly.
  if (message) after(async () => {
    try { await answer(message); }
    catch (error) { console.error('whatsapp_hook_failed', error instanceof CheckoutError ? error.code : error instanceof Error ? error.name : 'unknown'); }
  });
  return json({received: true});
}
