import {getPlan} from '../domain';
import type {SalesOrder} from '../payments/types';
import {notifyAdmin, sendText} from './botbot';
import {changePackage, createCustomer, getCustomer, renewCustomer, resolvePackages, type PackageKey, type SigmaCustomer} from './sigma';
import {claimActivation, claimNotice, findContact, findLink, linkOrder, markActivated, markFailed, saveCustomer, senderFromPhone} from './store';
import {paidText} from './texts';

const day = 86400000;
// True only when the supplier really added the paid period on top of what the customer already had.
export function gained(before: SigmaCustomer | null, after: SigmaCustomer, days: number, now = Date.now()) {
  const priorExpiry = before && before.is_trial !== 'YES' ? Date.parse(before.expires_at ?? '') : NaN;
  const base = Number.isFinite(priorExpiry) ? Math.max(priorExpiry, now) : now;
  return after.is_trial !== 'YES' && Date.parse(after.expires_at ?? '') >= base + (days - 5) * day;
}
// The owner must hear about a paid order that was not activated even when the WhatsApp notice cannot be sent.
async function park(order: SalesOrder, reason: string) {
  console.error('fulfillment_failed', order.id, reason.slice(0, 200));
  await markFailed(order.id, reason);
  await notifyAdmin(`⚠️ Aperte Play: pagamento aprovado sem liberação automática.\nPedido: ${order.id}\nPlano: ${order.plan_name}\nMotivo: ${reason.slice(0, 200)}\nLibere manualmente no painel.`);
}
export type Fulfillment = {state: 'activated' | 'already'; customer: SigmaCustomer; fresh: boolean} | {state: 'review' | 'busy'};
// Returns null for orders that are not payable or cannot be delivered automatically.
export async function fulfillOrder(order: SalesOrder): Promise<Fulfillment | null> {
  if (order.status !== 'approved' || order.fulfillment === 'review_required' || order.mode !== 'production') return null;
  const plan = getPlan(order.plan_id);
  if (!plan) return null;
  let link = await findLink(order.id);
  if (!link) {
    // Bot orders are linked before their Pix exists, so an unlinked paid order came from the site checkout.
    await linkOrder(order.id, senderFromPhone(order.phone), 'site');
    link = await findLink(order.id);
    if (!link) return null;
  }
  // A site buyer only types a phone number. It never selects an existing account: that would show and
  // change someone else's access, so a site order always gets an account of its own.
  const contact = link.origin === 'site' ? undefined : await findContact(link.sender);
  const customerId = link.customer_id ?? contact?.customer_id ?? null;
  if (link.activated_at) return customerId ? {state: 'already', customer: await getCustomer(customerId), fresh: link.origin === 'site'} : {state: 'review'};
  if (link.error) return {state: 'review'};
  if (link.claimed_at) {
    // A claim left behind by an interrupted run is never retried (credits may have been spent); it goes to review.
    if (Date.now() - new Date(link.claimed_at).getTime() < 3 * 60000) return {state: 'busy'};
    await park(order, 'liberação interrompida');
    return {state: 'review'};
  }
  // Read-only supplier calls come before the irreversible claim, so a passing failure can simply be retried.
  const target = (await resolvePackages())[plan.id as PackageKey];
  const before = contact?.customer_id ? await getCustomer(contact.customer_id) : null;
  if (!(await claimActivation(order.id))) return {state: 'busy'};
  try {
    let customer: SigmaCustomer;
    if (before) {
      customer = before.package_id === target.id && before.is_trial !== 'YES' ? before : await changePackage(before.id, target.id);
      if (!gained(before, customer, plan.days)) {
        // A package change that already moved the expiry is not followed by a renewal: that could charge two periods.
        if (before.is_trial !== 'YES' && Math.abs(Date.parse(customer.expires_at ?? '') - Date.parse(before.expires_at ?? '')) > day) throw new Error('validade alterada pela troca de plano');
        customer = await renewCustomer(before.id);
      }
      if (!gained(before, customer, plan.days)) throw new Error('período não aplicado');
    } else {
      customer = await createCustomer(target, {name: order.customer_name, whatsapp: /^\d{10,13}$/.test(link.sender) ? link.sender : undefined});
      if (link.origin !== 'site') await saveCustomer(link.sender, order.customer_name, customer.id);
    }
    await markActivated(order.id, customer.id);
    return {state: 'activated', customer, fresh: !before};
  } catch (error) {
    await park(order, error instanceof Error ? error.message : 'erro');
    return {state: 'review'};
  }
}
// Activates and pushes the confirmation to the buyer once.
export async function fulfillAndNotify(order: SalesOrder) {
  const result = await fulfillOrder(order);
  if (!result || !('customer' in result)) return result;
  const link = await findLink(order.id);
  if (link && !link.notified_at && await claimNotice(order.id)) await sendText(link.sender, paidText(order, result.customer));
  return result;
}
