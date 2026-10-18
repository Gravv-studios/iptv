import {trialHash,trialIdentity} from './trial-limit';
import {reserveLimitedTrial} from './trial-limit-store';

const base='https://painelprimelux.com/api/reseller-api/v1';
// Verified against the active ZEROUM rule and supplier catalogue on 2026-10-18.
const packageId='7loL7VM1XM',serverId='qK4WrQDeNj';
type Customer={id:string;whatsapp?:string;username?:string;password?:string;expires_at?:string;m3u_url?:string;renew_url?:string};
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
  const dns=new URL(c.m3u_url).origin;
  const pay=new URL(c.renew_url);
  if(pay.protocol!=='https:'||pay.hostname!=='painelprimelux.com') throw new Error('trial_payment_url_unexpected');
  const expires=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(c.expires_at));
  return {id:String(c.id),reply:`▶️ *Aperte Play — seu teste grátis está liberado!*\n\n✅ *Usuário:* ${c.username}\n✅ *Senha:* ${c.password}\n⏰ *Válido até:* ${expires}\n\n📲 *Como assistir*\nInstale um dos aplicativos abaixo e entre com o usuário e a senha acima:\n\n• *LOTUS* (Samsung, LG, Roku, Android TV, Windows e Mac) — código 2060\n• *RX PURPLE* (LG, Roku, Play Store e Windows) — código 85304368\n• *ZINK PLAYER* (Play Store, Fire TV e Roku)\n\nSe o aplicativo pedir endereço (DNS/URL): ${dns}\n\n💳 *Gostou? Assine por Pix neste link:*\n${pay.href}\n\nAssim que o pagamento é confirmado, seu acesso continua automaticamente, com o mesmo usuário e senha. Não precisa mudar nada no aplicativo.\n\nPrecisa de ajuda? É só responder esta mensagem.`};
}
