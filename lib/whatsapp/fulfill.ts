import {getPlan} from '../domain';
import type {SalesOrder} from '../payments/types';
import {notifyAdmin, sendText} from './botbot';
import {changePackage, createCustomer, getCustomer, renewCustomer, resolvePackages, type PackageKey, type SigmaCustomer} from './sigma';
import {claimActivation, claimNotice, findContact, findLink, markActivated, markFailed, saveCustomer} from './store';
import {paidText} from './texts';

const day = 86400000;
// True only when the supplier really added the paid period on top of what the customer already had.
export function gained(before: SigmaCustomer | null, after: SigmaCustomer, days: number, now = Date.now()) {
  const priorExpiry = before && before.is_trial !== 'YES' ? Date.parse(before.expires_at ?? '') : NaN;
  const base = Number.isFinite(priorExpiry) ? Math.max(priorExpiry, now) : now;
  return after.is_trial !== 'YES' && Date.parse(after.expires_at ?? '') >= base + (days - 5) * day;
}
export type Fulfillment = {state: 'activated' | 'already'; customer: SigmaCustomer} | {state: 'review' | 'busy'};
// Returns null for orders that did not start in WhatsApp or are not payable yet.
export async function fulfillOrder(order: SalesOrder): Promise<Fulfillment | null> {
  if (order.status !== 'approved' || order.fulfillment === 'review_required') return null;
  const link = await findLink(order.id);
  const plan = getPlan(order.plan_id);
  if (!link || !plan) return null;
  const contact = await findContact(link.sender);
  if (link.activated_at) return contact?.customer_id ? {state: 'already', customer: await getCustomer(contact.customer_id)} : {state: 'review'};
  if (!(await claimActivation(order.id))) return {state: link.error ? 'review' : 'busy'};
  try {
    const target = (await resolvePackages())[plan.id as PackageKey];
    let customer: SigmaCustomer;
    if (contact?.customer_id) {
      const before = await getCustomer(contact.customer_id);
      customer = before.package_id === target.id && before.is_trial !== 'YES' ? before : await changePackage(before.id, target.id);
      if (!gained(before, customer, plan.days)) customer = await renewCustomer(before.id);
      if (!gained(before, customer, plan.days)) throw new Error('período não aplicado');
    } else {
      customer = await createCustomer(target, {name: order.customer_name, whatsapp: /^\d{10,13}$/.test(link.sender) ? link.sender : undefined});
      await saveCustomer(link.sender, order.customer_name, customer.id);
    }
    await markActivated(order.id);
    return {state: 'activated', customer};
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro';
    await markFailed(order.id, reason);
    await notifyAdmin(`⚠️ Aperte Play: pagamento aprovado sem liberação automática.\nPedido: ${order.id}\nPlano: ${order.plan_name}\nMotivo: ${reason.slice(0, 200)}\nLibere manualmente no painel.`);
    return {state: 'review'};
  }
}
// Called from the payment webhook: activates and pushes the confirmation to the buyer once.
export async function fulfillAndNotify(order: SalesOrder) {
  const result = await fulfillOrder(order);
  if (!result || !('customer' in result)) return result;
  const link = await findLink(order.id);
  if (link && !link.notified_at && await claimNotice(order.id)) await sendText(link.sender, paidText(order, result.customer));
  return result;
}
