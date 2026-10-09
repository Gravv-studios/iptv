import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {getPlan} from '../../../../lib/domain';
import {trialHours} from '../../../../lib/offer';
import {CheckoutError, requirePaymentConfig} from '../../../../lib/payments/config';
import {failure, json} from '../../../../lib/payments/http';
import {checkOrigin, hash, readJson} from '../../../../lib/payments/security';
import type {SalesOrder} from '../../../../lib/payments/types';
import {sendText} from '../../../../lib/whatsapp/botbot';
import {requireWhatsappConfig} from '../../../../lib/whatsapp/config';
import {createCustomer, resolvePackages} from '../../../../lib/whatsapp/sigma';
import {senderFromPhone} from '../../../../lib/whatsapp/store';
import {paidText, publicAccess} from '../../../../lib/whatsapp/texts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const input = z.object({key: z.string().min(1).max(200), phone: z.string().transform(s => s.replace(/\D/g, '')).refine(s => /^\d{10,13}$/.test(s))}).strict();
// Owner-only rehearsal of the delivery after a payment. It never charges and never spends credits:
// the account is a free trial, and the secret travels in the body so it stays out of request logs.
export async function POST(request: Request) {
  try {
    const config = requireWhatsappConfig();
    checkOrigin(request, requirePaymentConfig().appUrl);
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success || !timingSafeEqual(Buffer.from(hash(parsed.data.key)), Buffer.from(hash(config.secret)))) throw new CheckoutError('PREVIEW_REFUSED', 401, 'Senha ou WhatsApp inválido.');
    const customer = await createCustomer((await resolvePackages()).trial, {name: 'Simulação de entrega', whatsapp: senderFromPhone(parsed.data.phone), trialHours});
    const plan = getPlan('mensal')!;
    const message = `${paidText({plan_name: plan.name} as SalesOrder, customer)}\n\n_Simulação: este acesso é um teste de ${trialHours} horas._`;
    return json({access: publicAccess(customer), sent: await sendText(senderFromPhone(parsed.data.phone), message)});
  } catch (error) {
    if (!(error instanceof CheckoutError)) console.error('whatsapp_preview_failed', error instanceof Error ? `${error.name} ${error.message.slice(0, 200)}` : 'unknown');
    return failure(error);
  }
}
