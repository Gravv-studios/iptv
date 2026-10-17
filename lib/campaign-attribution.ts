// Campaign labels are evidence of a tagged link, not proof of Meta attribution.
export const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id', 'adset_id', 'ad_id'] as const;
export type Campaign = Partial<Record<typeof campaignKeys[number], string>>;
export const attributionLifetime = 90 * 86400 * 1000;
export function campaignLabels(input: unknown): Campaign {
  if (!input || typeof input !== 'object') return {};
  const result: Campaign = {};
  for (const key of campaignKeys) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.length <= 150 && /^[\p{L}\p{N} _|.()\-]+$/u.test(value) && !value.includes('{{')) result[key] = value;
  }
  return result;
}
