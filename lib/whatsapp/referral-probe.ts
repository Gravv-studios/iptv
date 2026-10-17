import {createHmac} from 'node:crypto';

// Temporary passive probe. No message content, raw numbers, URLs, tokens or media are retained.
export const probeUntil = Date.parse('2026-10-19T20:30:00Z');
export function referralSummary(body: unknown, secret: string) {
  const result: {version: number; referralPresent: boolean; clickPresent: boolean; adIds: string[]; senderHashes: string[]; directions: boolean[]; event?: string; messageType?: string; truncated: boolean} =
    {version:1, referralPresent:false, clickPresent:false, adIds:[], senderHashes:[], directions:[], truncated:false};
  let budget = 1000;
  const digest = (value: string) => createHmac('sha256', secret).update('referral-probe:' + value).digest('hex');
  function walk(value: unknown, depth: number, referral = false) {
    if (depth > 12 || --budget < 0) {result.truncated=true; return;}
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {for (const child of value.slice(0,50)) walk(child, depth+1,referral); return;}
    for (const [key, item] of Object.entries(value)) {
      const normalized = key.replace(/_/g,'').toLowerCase();
      const context = referral || ['referral','externaladreply'].includes(normalized);
      if (['referral','externaladreply'].includes(normalized) && item && typeof item==='object') result.referralPresent=true;
      if (normalized==='ctwaclid' && typeof item==='string' && item.length>0) result.clickPresent=true;
      if ((normalized==='sourceid' && context || normalized==='adid') && typeof item==='string' && /^\d{5,30}$/.test(item)) result.adIds.push(item);
      if (['from','sender','remotejid','waid'].includes(normalized) && typeof item==='string') {
        const phone = item.replace(/@(s\.whatsapp\.net|c\.us)$/,'').replace(/^\+/, '');
        if (/^\d{10,15}$/.test(phone)) result.senderHashes.push(digest(phone));
      }
      if (normalized==='fromme' && typeof item==='boolean') result.directions.push(item);
      if (depth===0 && ['event','messageType'].includes(key) && typeof item==='string' && /^[a-zA-Z_.-]{1,40}$/.test(item)) result[key as 'event'|'messageType']=item;
      if (item && typeof item==='object') walk(item,depth+1,context);
    }
  }
  walk(body,0);
  result.adIds=[...new Set(result.adIds)].slice(0,10);
  result.senderHashes=[...new Set(result.senderHashes)].slice(0,10);
  result.directions=[...new Set(result.directions)];
  return result;
}
