import {getPlan, money} from './domain';
import {whatsappNumber} from './offer';

export function purchaseUrl(planId: string): string {
  const plan = getPlan(planId);
  if (!plan) throw new Error('INVALID_PLAN');
  const message = `Olá! Quero contratar o ${plan.name}, por ${money(plan.amount)} no total, para ${plan.period} de acesso. Pode confirmar o catálogo, a compatibilidade do meu aparelho e me orientar sobre o pagamento e a ativação?`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const customerSupportUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Sou cliente da Aperte Play e preciso de ajuda com meu acesso ou renovação.')}`;
