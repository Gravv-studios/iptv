'use client';
type Pixel = ((...args: unknown[]) => void) & {queue?: unknown[][]; callMethod?: (...args: unknown[]) => void; loaded?: boolean; version?: string; push?: Pixel};
declare global {interface Window {fbq?: Pixel; _fbq?: Pixel}}
export const consentKey = 'aperte-marketing-v1';
export function marketingConsent() {try {return localStorage.getItem(consentKey) === 'accepted';} catch {return false;}}
export function trackMeta(name: string, data: Record<string, unknown> = {}, eventId?: string) {
  if (!marketingConsent() || !window.fbq) return;
  window.fbq('track', name, data, ...(eventId ? [{eventID: eventId}] : []));
}
export function checkoutAttribution() {
  if (!marketingConsent()) return undefined;
  const cookie = (key: string) => document.cookie.split('; ').find(x => x.startsWith(key + '='))?.slice(key.length+1);
  return {consent: true, fbp: cookie('_fbp'), fbc: cookie('_fbc')};
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
