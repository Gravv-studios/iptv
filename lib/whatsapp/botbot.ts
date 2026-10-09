import {whatsappConfig} from './config';

async function post(to: string, message: string) {
  const config = whatsappConfig();
  const response = await fetch('https://botbot.chat/api/v2/sendText', {
    method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', appKey: config.appKey, authKey: config.authKey},
    body: JSON.stringify({to, message: message.slice(0, 3500)}), signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
  });
  // Status and the provider's short reason only; never the recipient, the message or the keys.
  if (!response.ok) console.warn('botbot_send_refused', response.status, `digits:${to.length}`, (await response.text().catch(() => '')).replace(/\d{8,}/g, '#').slice(0, 160));
  return response.ok;
}
// BotBot API 2.0.0, POST /api/v2/sendText. Returns false instead of throwing: a lost notice must not undo an activation.
export async function sendText(to: string, message: string) {
  if (!whatsappConfig().canSend || !to) return false;
  try {
    if (await post(to, message)) return true;
    // BotBot lists Brazilian mobiles without the ninth digit (55 + DDD + 8 digits); retry in that format.
    const legacy = /^55\d{2}9\d{8}$/.test(to) ? to.slice(0, 4) + to.slice(5) : '';
    return legacy ? await post(legacy, message) : false;
  } catch { return false; }
}
export async function notifyAdmin(message: string) {
  const {admin} = whatsappConfig();
  return admin ? sendText(admin, message) : false;
}
