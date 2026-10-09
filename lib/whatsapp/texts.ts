import {plans} from '../domain';
import {trialHours} from '../offer';
import type {SalesOrder} from '../payments/types';
import type {SigmaCustomer} from './sigma';

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const when = (iso: string | null) => iso && Number.isFinite(Date.parse(iso))
  ? new Date(iso).toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'consulte o atendimento';
function server(customer: SigmaCustomer) {
  try { return customer.m3u_url ? new URL(customer.m3u_url).origin : ''; } catch { return ''; }
}
const access = (customer: SigmaCustomer) => `✅ *Usuário:* ${customer.username}\n✅ *Senha:* ${customer.password ?? 'a mesma de antes'}\n⏰ *Válido até:* ${when(customer.expires_at)}`;
export type PublicAccess = {username: string; password: string | null; expiresAt: string; server: string};
export const publicAccess = (customer: SigmaCustomer): PublicAccess => ({username: customer.username, password: customer.password, expiresAt: when(customer.expires_at), server: server(customer)});
export const plansText = () => `Escolha o plano e responda com a palavra:\n\n${plans.map(p => `• *${p.id}* — ${money(p.amount)} (${p.period})`).join('\n')}\n\nO pagamento é por Pix, aqui mesmo na conversa.`;
export function trialText(customer: SigmaCustomer) {
  const dns = server(customer);
  return `▶️ *Aperte Play — seu teste grátis de ${trialHours} horas está liberado!*\n\n${access(customer)}\n\n📲 *Como assistir*\nInstale um dos aplicativos abaixo e entre com o usuário e a senha acima:\n\n• *LOTUS* (Samsung, LG, Roku, Android TV, Windows e Mac) — código 2050\n• *RX PURPLE* (LG, Roku, Play Store e Windows) — código 41494302\n• *ZINK PLAYER* (Play Store, Fire TV e Roku)\n${dns ? `\nSe o aplicativo pedir endereço (DNS/URL): ${dns}\n` : ''}\nGostou? Para continuar depois do teste, responda *mensal*, *semestral* ou *anual* e pague por Pix aqui mesmo.\n\nPrecisa de ajuda para instalar? É só responder esta mensagem.`;
}
export const statusText = (customer: SigmaCustomer) => customer.is_trial === 'YES'
  ? `Você já tem um teste grátis neste número.\n\n${access(customer)}\n\n${plansText()}`
  : `Seu acesso Aperte Play:\n\n${access(customer)}\n\nPara renovar: ${plansText()}`;
export const pixIntroText = (order: SalesOrder) => `✅ *${order.plan_name}* — ${money(order.amount_cents)} (${order.period})\n\nA próxima mensagem traz o *Pix copia e cola*. Copie o código inteiro, abra o app do seu banco, escolha Pix → Copia e cola e pague.\n\nO código vale por 30 minutos. A confirmação chega aqui; se não chegar em 1 minuto depois de pagar, responda *paguei*.`;
export const pixUnavailableText = 'Não consegui gerar o Pix agora. Tente de novo em alguns minutos ou fale com o atendimento respondendo esta mensagem.';
export const paidText = (order: SalesOrder, customer: SigmaCustomer) => `✅ *Pagamento confirmado!* Obrigado.\n\n*Plano:* ${order.plan_name}\n${access(customer)}\n\nSeu acesso continua no mesmo aplicativo, sem mudar nada. Bom play! ▶️`;
export const pendingText = 'Ainda não recebemos a confirmação do seu Pix. Ela costuma chegar em menos de 1 minuto; se você já pagou, responda *paguei* de novo daqui a pouco.';
export const reviewText = 'Recebemos seu pagamento ✅ e a equipe está finalizando a liberação do acesso. Você recebe a confirmação aqui em instantes.';
export const noOrderText = `Não encontrei um pedido de pagamento deste número.\n\n${plansText()}`;
export const helpText = () => `Olá! Sou o atendimento automático da *Aperte Play* ▶️\n\n• Responda *teste* para ganhar ${trialHours} horas grátis.\n• ${plansText()}`;
export const busyText = 'O atendimento automático está indisponível no momento. Tente de novo em alguns minutos.';
