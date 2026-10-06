export class CheckoutError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export function paymentConfig() {
  const mode = process.env.MP_MODE === 'production' ? 'production' : 'test';
  const publicKey = process.env.MP_PUBLIC_KEY ?? '';
  const accessToken = process.env.MP_ACCESS_TOKEN ?? '';
  const webhookSecret = process.env.MP_WEBHOOK_SECRET ?? '';
  const sessionSecret = process.env.PAYMENTS_SESSION_SECRET ?? '';
  const collectorId = process.env.MP_COLLECTOR_ID ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const appUrl = process.env.APP_URL ?? '';
  let validUrl = false;
  try { const u = new URL(appUrl); validUrl = u.protocol === 'https:' && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password; } catch {}
  const enabled = process.env.PAYMENTS_ENABLED === 'true';
  const ready = enabled && validUrl && !!publicKey && !!accessToken && !!webhookSecret &&
    sessionSecret.length >= 32 && /^\d+$/.test(collectorId) && /^postgres(?:ql)?:\/\//.test(databaseUrl);
  return {mode, publicKey, accessToken, webhookSecret, sessionSecret, collectorId, databaseUrl, appUrl: appUrl.replace(/\/$/, ''), ready} as const;
}
export function requirePaymentConfig() {
  const config = paymentConfig();
  if (!config.ready) throw new CheckoutError('PAYMENTS_NOT_CONFIGURED', 503, 'O pagamento online está em ativação. Nenhuma cobrança foi realizada.');
  return config;
}
