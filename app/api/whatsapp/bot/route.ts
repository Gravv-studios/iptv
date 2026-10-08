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
    const message = parseMessage(await readJson(request));
    if (!message) return json({reply: ''});
    return json({reply: await reply(message, url.searchParams.get('part'))});
  } catch (error) {
    // Never put sender data, tokens or supplier responses in logs.
    console.error('whatsapp_bot_failed', error instanceof CheckoutError ? error.code : error instanceof Error ? error.name : 'unknown');
    return json({reply: busyText});
  }
}
