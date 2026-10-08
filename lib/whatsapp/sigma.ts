import {CheckoutError} from '../payments/config';
import {requireWhatsappConfig} from './config';

// Sigma Reseller API (OpenAPI 3.1, v1.0.0) as published by the supplier panel.
export type SigmaCustomer = {
  id: string; username: string; password: string | null; expires_at: string | null; status: string;
  is_trial: 'YES' | 'NO' | null; package: string | null; package_id: string | null; m3u_url: string | null;
};
export type SigmaPackage = {
  id: string; server_id: string; server: string | null; name: string; status: string;
  is_trial: 'YES' | 'NO' | null; is_adult: boolean; duration: number; duration_in: string;
};
export type PackageKey = 'trial' | 'mensal' | 'semestral' | 'anual';
export class SigmaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const config = requireWhatsappConfig();
  const response = await fetch(config.apiUrl + path, {
    method, headers: {Accept: 'application/json', Authorization: `Bearer ${config.token}`, ...(body ? {'Content-Type': 'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store',
  });
  const raw: unknown = await response.json().catch(() => null);
  const result = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (!response.ok) {
    // Validation text names fields only; it never echoes the bearer token.
    const detail = result.errors && typeof result.errors === 'object' ? ' ' + Object.keys(result.errors).join(',') : '';
    throw new SigmaError(response.status, `${typeof result.message === 'string' ? result.message.slice(0, 160) : 'erro'}${detail}`.slice(0, 220));
  }
  return result as T;
}
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const patterns: Record<PackageKey, RegExp> = {trial: /TESTE IPTV COMPLETO/, mensal: /^MENSAL\b/, semestral: /^SEMESTRAL\b/, anual: /^ANUAL\b/};
export function pickPackages(all: SigmaPackage[], server: string, overrides: Partial<Record<PackageKey, string>> = {}) {
  const result = {} as Record<PackageKey, SigmaPackage>;
  for (const key of Object.keys(patterns) as PackageKey[]) {
    const matches = overrides[key] ? all.filter(p => p.id === overrides[key]) : all.filter(p => {
      const name = fold(p.name).replace(/[^A-Z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
      return fold(p.server ?? '').includes(fold(server)) && (p.is_trial === 'YES') === (key === 'trial') &&
        !p.is_adult && /\bS\/ ?ADULTOS\b|\bSEM ADULTOS\b/.test(name) && patterns[key].test(name);
    });
    // Never guess between two candidates: a wrong package would sell adult content or the wrong period.
    if (matches.length !== 1) throw new CheckoutError('PACKAGE_NOT_RESOLVED', 503, `Pacote ${key} não identificado (${matches.length}).`);
    result[key] = matches[0];
  }
  return result;
}
let cache: {expires: number; packages: Record<PackageKey, SigmaPackage>} | undefined;
export async function resolvePackages() {
  if (cache && cache.expires > Date.now()) return cache.packages;
  const config = requireWhatsappConfig();
  const all: SigmaPackage[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await call<{data?: SigmaPackage[]; meta?: {last_page?: number}}>('GET', `/packages?per_page=100&page=${page}`);
    all.push(...(result.data ?? []));
    if (page >= Number(result.meta?.last_page ?? 1)) break;
  }
  const packages = pickPackages(all, config.server, Object.fromEntries(Object.entries(config.packages).filter(([, id]) => !!id)));
  cache = {expires: Date.now() + 10 * 60000, packages};
  return packages;
}
const customer = (result: {data?: SigmaCustomer}) => {
  if (!result.data?.id || !result.data.username) throw new SigmaError(502, 'resposta sem cliente');
  return result.data;
};
export const getCustomer = async (id: string) => customer(await call('GET', `/customers/${encodeURIComponent(id)}`));
export const changePackage = async (id: string, packageId: string) => customer(await call('PUT', `/customers/${encodeURIComponent(id)}/package`, {package_id: packageId}));
export const renewCustomer = async (id: string) => customer(await call('POST', `/customers/${encodeURIComponent(id)}/renew`));
export async function createCustomer(pkg: SigmaPackage, input: {name: string; whatsapp?: string; trialHours?: number}) {
  return customer(await call('POST', '/customers', {
    server_id: pkg.server_id, package_id: pkg.id, name: input.name, note: 'WhatsApp Aperte Play',
    ...(input.whatsapp ? {whatsapp: input.whatsapp} : {}), ...(input.trialHours ? {trial_hours: input.trialHours} : {}),
  }));
}
