import {timingSafeEqual} from 'node:crypto';
import {CheckoutError} from '../../../../lib/payments/config';
import {json} from '../../../../lib/payments/http';
import {hash, readJson} from '../../../../lib/payments/security';
import {parseMessage, reply} from '../../../../lib/whatsapp/bot';
import {whatsappConfig} from '../../../../lib/whatsapp/config';
import {busyText} from '../../../../lib/whatsapp/texts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// Called by BotBot chatbot rules. The shared secret in the rule URL is the only caller authentication BotBot offers.
export async function POST(request: Request) {
  const config = whatsappConfig();
  const url = new URL(request.url);
  const key = url.searchParams.get('k') ?? '';
  if (!config.ready || !timingSafeEqual(Buffer.from(hash(key)), Buffer.from(hash(config.secret)))) return json({error: 'Não autorizado.'}, 401);
  try {
    const body = await readJson(request);
    const message = parseMessage(body);
    if (!message) {
      // Field names and value sizes only, to learn what BotBot really posts; never the values.
      console.warn('whatsapp_bot_unparsed', body && typeof body === 'object' ? Object.entries(body as Record<string, unknown>).map(([name, value]) => `${name.slice(0, 30)}:${typeof value}:${String(value ?? '').length}`).slice(0, 30).join(' ') : typeof body);
      return json({reply: ''});
    }
    const text = await reply(message, url.searchParams.get('part'));
    console.info('whatsapp_bot_reply', `part:${url.searchParams.get('part') ?? '-'} length:${text.length}`);
    return json({reply: text});
  } catch (error) {
    // Never put sender data, tokens or supplier responses in logs.
    console.error('whatsapp_bot_failed', error instanceof CheckoutError ? error.code : error instanceof Error ? error.name : 'unknown');
    return json({reply: busyText});
  }
}
