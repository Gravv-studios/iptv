import {CheckoutError, requirePaymentConfig} from '../payments/config';
import {getVerifiedAccount, pixBody, reconcileOrder, submitPayment} from '../payments/mercado-pago';
import {createOrder, findOrder, reserveSubmission} from '../payments/repository';
import {hash} from '../payments/security';
import {storedInstructions, type SalesOrder} from '../payments/types';
import {trialHours} from '../offer';
import {sendText} from './botbot';
import {fulfillOrder} from './fulfill';
import {createCustomer, getCustomer, resolvePackages} from './sigma';
import {claimMessage, claimNotice, findContact, latestOrder, linkOrder, releaseTrial, reserveTrial, saveCustomer} from './store';
import {busyText, helpText, noOrderText, paidText, pendingText, pixIntroText, pixUnavailableText, plansText, reviewText, statusText, trialText} from './texts';

export type BotMessage = {sender: string; name: string; text: string; at: number};
export type Intent = {kind: 'plan'; plan: 'mensal' | 'semestral' | 'anual'} | {kind: 'paid' | 'pay' | 'trial' | 'help'};
// Body BotBot posts for a "URL, Servidor Externo ou Webhook" reply.
export function parseMessage(body: unknown): BotMessage | null {
  const data = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  // Contacts hidden behind a WhatsApp LID may arrive without a phone; fall back to any other sender identifier.
  const identifier = [data.senderPhone, data.senderLid, data.senderId, data.senderJid, data.sender, data.chatId, data.from].find(value => (typeof value === 'string' || typeof value === 'number') && String(value).trim());
  const sender = String(identifier ?? '').replace(/[^\w@.:-]/g, '').slice(0, 60);
  const text = typeof data.senderMessage === 'string' ? data.senderMessage.slice(0, 400) : '';
  if (!sender || !text) return null;
  const name = typeof data.senderName === 'string' ? data.senderName.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 60) : '';
  const at = Number(data.messageDateTime);
  return {sender, name: name.length >= 3 ? name : 'Cliente WhatsApp', text, at: Number.isFinite(at) && at > 0 ? Math.floor(at) : Math.floor(Date.now() / 60000)};
}
// Body of a BotBot device webhook. Only text sent by a person in a private chat is answered.
export function parseHook(body: unknown): (BotMessage & {id: string}) | null {
  const data = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const sender = typeof data.from === 'string' ? data.from : '';
  const id = typeof data.messageId === 'string' ? data.messageId.slice(0, 120) : '';
  if (data.event !== 'message' || data.messageType !== 'text' || typeof data.message !== 'string' || !data.message.trim() || !id) return null;
  if (!/^\d{10,15}$/.test(sender) || sender === String(data.devicePhone ?? '')) return null;
  const at = Number(data.timestamp);
  return {id, sender, name: 'Cliente WhatsApp', text: data.message.slice(0, 400), at: Number.isFinite(at) && at > 0 ? Math.floor(at) : Math.floor(Date.now() / 60000)};
}
export function intentOf(text: string): Intent {
  const words = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plan = (['semestral', 'anual', 'mensal'] as const).find(id => new RegExp(`\\b${id}\\b`).test(words));
  if (plan) return {kind: 'plan', plan};
  if (/\b(paguei|comprovante)\b/.test(words)) return {kind: 'paid'};
  if (/\b(pagar|pix|assinar|renovar|comprar|plano|planos)\b/.test(words)) return {kind: 'pay'};
  if (/\bteste/.test(words)) return {kind: 'trial'};
  return {kind: 'help'};
}
const uuidFrom = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
const pixCode = (order: SalesOrder) => ['pending', 'in_process', 'created'].includes(order.status) ? storedInstructions(order.payment_instructions)?.qrCode : undefined;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Both reply blocks of the BotBot rule call this; the request key makes them share one order and one charge.
export async function ensurePix(message: BotMessage, planId: string) {
  const config = requirePaymentConfig();
  const recent = await latestOrder(message.sender, planId);
  const age = recent ? Date.now() - new Date(recent.created_at).getTime() : Infinity;
  if (recent && pixCode(recent) && age < 25 * 60000) return recent;
  const digits = message.sender.replace(/\D/g, '');
  // An order opened seconds ago by the sibling reply block is awaited instead of duplicated.
  let order = recent && age < 60000 && ['created', 'pending', 'in_process'].includes(recent.status) ? recent : await createOrder({
    requestKey: uuidFrom(hash(`wa:${message.sender}:${planId}:${message.at}`)), planId, customerName: message.name,
    email: `cliente.${hash('wa:' + message.sender).slice(0, 12)}@${new URL(config.appUrl).hostname.replace(/^www\./, '')}`,
    phone: /^\d{10,13}$/.test(digits) ? digits : '0000000000',
  }, hash('wa:' + message.sender), config.mode);
  await linkOrder(order.id, message.sender);
  if (!order.submission_hash) {
    const body = pixBody(order);
    await getVerifiedAccount();
    try { order = await submitPayment(await reserveSubmission(order.id, hash(JSON.stringify(body))), body); }
    catch (error) { if (!(error instanceof CheckoutError) || error.code !== 'PAYMENT_ALREADY_SUBMITTED') throw error; }
  }
  // The other reply block may still be creating the charge.
  for (let attempt = 0; attempt < 6 && !pixCode(order) && ['created', 'pending', 'in_process'].includes(order.status); attempt++) {
    await sleep(1000);
    order = await findOrder(order.id) ?? order;
  }
  return order;
}
async function trial(message: BotMessage) {
  const contact = await findContact(message.sender);
  if (contact?.customer_id) return statusText(await getCustomer(contact.customer_id));
  if (!(await reserveTrial(message.sender, message.name))) return `Seu teste grátis já foi solicitado neste número.\n\n${plansText()}`;
  try {
    const digits = message.sender.replace(/\D/g, '');
    const customer = await createCustomer((await resolvePackages()).trial, {name: message.name, whatsapp: /^\d{10,13}$/.test(digits) ? digits : undefined, trialHours});
    await saveCustomer(message.sender, message.name, customer.id);
    return trialText(customer);
  } catch (error) { await releaseTrial(message.sender); throw error; }
}
async function paid(message: BotMessage) {
  const found = await latestOrder(message.sender);
  if (!found) return noOrderText;
  const order = await reconcileOrder(found);
  if (order.status !== 'approved') return ['pending', 'in_process', 'created', 'authorized'].includes(order.status) ? pendingText : noOrderText;
  const result = await fulfillOrder(order);
  if (!result || !('customer' in result)) return reviewText;
  await claimNotice(order.id);
  return paidText(order, result.customer);
}
// part: '1' intro, '2' Pix code only, anything else both in one message.
export async function reply(message: BotMessage, part: string | null) {
  const intent = intentOf(message.text);
  if (!('plan' in intent)) {
    if (part === '2') return '';
    return intent.kind === 'trial' ? trial(message) : intent.kind === 'paid' ? paid(message) : intent.kind === 'pay' ? plansText() : helpText();
  }
  const order = await ensurePix(message, intent.plan);
  const code = pixCode(order);
  if (!code) return part === '2' ? '' : pixUnavailableText;
  return part === '1' ? pixIntroText(order) : part === '2' ? code : `${pixIntroText(order)}\n\n${code}`;
}
// Device-webhook path: the answer is pushed through the BotBot API. Ordinary conversation gets no automatic reply.
export async function answer(message: BotMessage & {id: string}) {
  const intent = intentOf(message.text);
  if (intent.kind === 'help' || !(await claimMessage(message.id))) return false;
  try {
    if (!('plan' in intent)) return await sendText(message.sender, await reply(message, null));
    await sendText(message.sender, await reply(message, '1'));
    const code = await reply(message, '2');
    return code ? await sendText(message.sender, code) : false;
  } catch (error) {
    await sendText(message.sender, busyText);
    throw error;
  }
}
