import {whatsappConfig} from './config';

// BotBot API 2.0.0, POST /api/v2/sendText. Returns false instead of throwing: a lost notice must not undo an activation.
export async function sendText(to: string, message: string) {
  const config = whatsappConfig();
  if (!config.canSend || !to) return false;
  try {
    const response = await fetch('https://botbot.chat/api/v2/sendText', {
      method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', appKey: config.appKey, authKey: config.authKey},
      body: JSON.stringify({to, message: message.slice(0, 3500)}), signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
    });
    return response.ok;
  } catch { return false; }
}
export async function notifyAdmin(message: string) {
  const {admin} = whatsappConfig();
  return admin ? sendText(admin, message) : false;
}
