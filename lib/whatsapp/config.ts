import {CheckoutError, paymentConfig} from '../payments/config';

// Secrets live only in the deployment environment. The bot secret also travels in the BotBot rule URL.
export function whatsappConfig() {
  const apiUrl = (process.env.SIGMA_API_URL ?? 'https://painelprimelux.com/api/reseller-api/v1').replace(/\/$/, '');
  const token = process.env.SIGMA_API_TOKEN ?? '';
  const appKey = process.env.BOTBOT_APP_KEY ?? '';
  const authKey = process.env.BOTBOT_AUTH_KEY ?? '';
  const secret = process.env.WHATSAPP_BOT_SECRET ?? '';
  const ready = paymentConfig().ready && /^https:\/\//.test(apiUrl) && !!token && secret.length >= 24;
  return {apiUrl, token, appKey, authKey, secret, ready, canSend: !!appKey && !!authKey,
    server: process.env.SIGMA_SERVER_NAME ?? 'PRIMELUX SERVER',
    admin: (process.env.WHATSAPP_ADMIN ?? '').replace(/\D/g, ''),
    packages: {trial: process.env.SIGMA_PACKAGE_TRIAL ?? '', mensal: process.env.SIGMA_PACKAGE_MENSAL ?? '', semestral: process.env.SIGMA_PACKAGE_SEMESTRAL ?? '', anual: process.env.SIGMA_PACKAGE_ANUAL ?? ''},
  } as const;
}
export function requireWhatsappConfig() {
  const config = whatsappConfig();
  if (!config.ready) throw new CheckoutError('WHATSAPP_NOT_CONFIGURED', 503, 'O atendimento automático está em ativação.');
  return config;
}
