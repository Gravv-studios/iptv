import {trialHash,trialIdentity} from './trial-limit';
import {reserveLimitedTrial} from './trial-limit-store';
import {trialMessage,type TrialAccess} from './trial-message';
import {trialPaymentLink,safeRenewalUrl} from './trial-payment-link';

const base='https://painelprimelux.com/api/reseller-api/v1';
// Verified against the active ZEROUM rule and supplier catalogue on 2026-10-18.
const packageId='7loL7VM1XM',serverId='qK4WrQDeNj';
type Customer=TrialAccess;
type Package={id:string;server_id:string;is_trial:string;name:string;duration:number;duration_in:string};
async function request<T>(path:string,body?:unknown):Promise<T> {
  const token=process.env.SIGMA_API_TOKEN;
  if(!token) throw new Error('trial_supplier_not_configured');
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});
  if(!response.ok) throw new Error('trial_supplier_failed');
  return await response.json() as T;
}
export async function prepareTrialHistory(secret:string) {
  let total=0,identified=0,missing=0;
  for(let page=1;page<=100;page++) {
    const result=await request<{data:Customer[];meta:{last_page:number}}>(`/customers?per_page=100&page=${page}`);
    if(!Array.isArray(result.data) || !Number.isInteger(result.meta?.last_page) || result.meta.last_page>100) throw new Error('trial_history_incomplete');
    for(const row of result.data) {
      total++;
      const identity=trialIdentity(row.whatsapp);
      if(identity && typeof row.id==='string') {await reserveLimitedTrial([trialHash(identity,secret)],row.id);identified++;}
      else missing++;
    }
    if(page>=result.meta.last_page) return {total,identified,missing};
  }
  throw new Error('trial_history_incomplete');
}
export async function checkTrialPackage() {
  const result=await request<{data:Package[]}>('/packages?per_page=100&page=1');
  const pkg=result.data?.find((p:{id:string})=>p.id===packageId);
  if(!pkg || pkg.server_id!==serverId || pkg.is_trial!=='YES' || !/S\/\s*ADULTOS/.test(pkg.name) || pkg.duration!==4 || pkg.duration_in!=='HOURS') throw new Error('trial_package_changed');
}
export async function createLimitedTrial(input:{id:string;phone?:string;name:string}) {
  // A fixed username per durable reservation adds a second barrier at the supplier.
  // Never retry creation automatically, even when the supplier response is lost.
  const result=await request<{data:Customer}>('/customers',{
    server_id:serverId,package_id:packageId,trial_hours:4,
    username:'ap'+input.id.replace(/-/g,'').slice(0,16),
    name:input.name, ...(input.phone?{whatsapp:input.phone}:{}),
    note:'Aperte Play — teste único '+input.id,
  });
  const c=result.data;
  if(!c?.id || !c.username || !c.password || !c.expires_at || !c.m3u_url || !c.renew_url) throw new Error('trial_response_incomplete');
  safeRenewalUrl(c.renew_url);
  return {id:String(c.id),reply:trialMessage(c,trialPaymentLink(c.id,process.env.WHATSAPP_BOT_SECRET??''))};
}
export async function trialRenewalUrl(id:string) {
  const result=await request<{data:Customer}>('/customers/'+encodeURIComponent(id));
  if(result.data?.id!==id||!result.data.renew_url) throw new Error('trial_payment_unavailable');
  return safeRenewalUrl(result.data.renew_url);
}
