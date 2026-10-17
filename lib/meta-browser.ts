'use client';
import {attributionLifetime, campaignLabels, type Campaign} from './campaign-attribution';
type Pixel = ((...args: unknown[]) => void) & {queue?: unknown[][]; callMethod?: (...args: unknown[]) => void; loaded?: boolean; version?: string; push?: Pixel};
declare global {interface Window {fbq?: Pixel; _fbq?: Pixel}}
export const consentKey = 'aperte-marketing-v1';
export const attributionKey = 'aperte-attribution-v1';
type SavedAttribution = {capturedAt: number; campaign: Campaign};
export function clearCampaignAttribution() {try {localStorage.removeItem(attributionKey);} catch {}}
export function captureCampaignAttribution() {
  if (!marketingConsent()) return undefined;
  const now = Date.now();
  const params = new URLSearchParams(window.location.search);
  const campaign = campaignLabels(Object.fromEntries(params));
  let saved: SavedAttribution | undefined;
  try {
    const raw = JSON.parse(localStorage.getItem(attributionKey) ?? 'null');
    if (raw && Number.isFinite(raw.capturedAt) && raw.capturedAt <= now && now - raw.capturedAt < attributionLifetime) saved = {capturedAt: raw.capturedAt, campaign: campaignLabels(raw.campaign)};
    else clearCampaignAttribution();
  } catch {clearCampaignAttribution();}
  if (Object.keys(campaign).length) {
    // A direct visit does not erase the last tagged visit or extend its lifetime.
    if (!saved || JSON.stringify(saved.campaign) !== JSON.stringify(campaign)) {
      saved = {capturedAt: now, campaign};
      try {localStorage.setItem(attributionKey, JSON.stringify(saved));} catch {}
    }
  }
  const click = params.get('fbclid');
  if (click && /^[A-Za-z0-9_-]{1,450}$/.test(click)) {
    const existing = document.cookie.split('; ').find(x => x.startsWith('_fbc='))?.slice(5);
    if (!existing?.endsWith(`.${click}`)) document.cookie = `_fbc=fb.1.${now}.${click}; Max-Age=7776000; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  return saved;
}
export function marketingConsent() {try {return localStorage.getItem(consentKey) === 'accepted';} catch {return false;}}
export function trackMeta(name: string, data: Record<string, unknown> = {}, eventId?: string) {
  if (!marketingConsent() || !window.fbq) return;
  window.fbq('track', name, data, ...(eventId ? [{eventID: eventId}] : []));
}
export function checkoutAttribution() {
  if (!marketingConsent()) return undefined;
  const saved = captureCampaignAttribution();
  const cookie = (key: string) => document.cookie.split('; ').find(x => x.startsWith(key + '='))?.slice(key.length+1);
  return {consent: true, fbp: cookie('_fbp'), fbc: cookie('_fbc'), ...(saved ? {campaign: saved.campaign, capturedAt: saved.capturedAt} : {})};
}
export function loadPixel(id: string) {
  if (!marketingConsent() || !/^\d+$/.test(id) || window.fbq) return;
  const fbq: Pixel = (...args: unknown[]) => {if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue!.push(args);};
  fbq.queue=[]; fbq.loaded=true; fbq.version='2.0'; fbq.push=fbq;
  window.fbq=window._fbq=fbq;
  fbq('set','autoConfig',false,id);
  fbq('init',id);
  const script=document.createElement('script'); script.async=true; script.src='https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
}
