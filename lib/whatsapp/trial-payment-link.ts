import {createHmac,timingSafeEqual} from 'node:crypto';
const validId=(id:string)=>/^[a-zA-Z0-9_-]{1,100}$/.test(id);
function signature(id:string,secret:string) {
  if(secret.length<24 || !validId(id)) throw new Error('invalid_trial_payment_link');
  return createHmac('sha256',secret).update('trial-payment-v1:'+id).digest('hex');
}
export function trialPaymentLink(id:string,secret:string) {
  return `https://www.aperteoplayiptv.com.br/continuar?acesso=${encodeURIComponent(id)}&assinatura=${signature(id,secret)}`;
}
export function validTrialPaymentLink(id:string,sig:string,secret:string) {
  if(!validId(id)||secret.length<24||! /^[a-f0-9]{64}$/.test(sig)) return false;
  return timingSafeEqual(Buffer.from(sig),Buffer.from(signature(id,secret)));
}
export function safeRenewalUrl(value:string) {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='painelprimelux.com'||url.port||url.username||url.password) throw new Error('trial_payment_url_unexpected');
  return url.href;
}
