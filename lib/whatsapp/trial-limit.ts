import {createHmac} from 'node:crypto';

// A LID is an opaque WhatsApp identifier, NEVER a telephone number.
export function trialIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw=value.trim();
  if (/^\d{6,20}@lid$/.test(raw)) return 'lid:'+raw.slice(0,-4);
  const plain=raw.replace(/@(s\.whatsapp\.net|c\.us)$/,'');
  if (!/^\+?[\d ()-]+$/.test(plain)) return null;
  let digits=plain.replace(/\D/g,'');
  if (digits.length===10 || digits.length===11) digits='55'+digits;
  if (!/^55[1-9]\d\d{8,9}$/.test(digits)) return null;
  // Brazilian mobile numbers are sometimes delivered without their ninth digit.
  if (digits.length===12 && /^[6-9]/.test(digits.slice(4))) digits=digits.slice(0,4)+'9'+digits.slice(4);
  return 'phone:'+digits;
}
export const trialHash=(identity:string,secret:string)=>createHmac('sha256',secret).update('trial-lifetime-v1:'+identity).digest('hex');
// Diagnostic shape only: no phone, LID, name, message, credentials or raw body.
export function trialPayloadShape(body:unknown) {
  const fields=['senderPhone','senderLid','senderId','senderJid','sender','chatId','from','remoteJid','phone','devicePhone','senderName','senderMessage','messageDateTime'];
  const containers=['data','body','payload','message'];
  const result:Record<string,unknown>={};
  function describe(value:unknown,prefix='') {
    if(!value||typeof value!=='object'||Array.isArray(value)) return;
    const record=value as Record<string,unknown>;
    for(const key of fields) if(key in record) {
      const v=record[key];
      const s=typeof v==='string'?v:typeof v==='number'?String(v):'';
      result[prefix+key]={type:typeof v,length:s.length,identity:trialIdentity(v)?.split(':')[0]??null,
        numeric:typeof v==='string'&&/^\d+$/.test(v),jid:typeof v==='string'&&/@/.test(v)};
    }
    if(!prefix) for(const key of containers) if(record[key]&&typeof record[key]==='object')describe(record[key],key+'.');
  }
  describe(body);
  return result;
}
export function trialSender(body:unknown) {
  if(!body || typeof body!=='object' || Array.isArray(body)) return null;
  const b=body as Record<string,unknown>;
  const ids=[...new Set([b.senderPhone,b.senderLid,b.senderJid].map(trialIdentity).filter((s):s is string=>!!s))].sort();
  if(!ids.length || ids.filter(s=>s.startsWith('phone:')).length>1 || ids.filter(s=>s.startsWith('lid:')).length>1) return null;
  return {ids,phone:ids.find(s=>s.startsWith('phone:'))?.slice(6),name:typeof b.senderName==='string'?b.senderName.slice(0,80):'Cliente WhatsApp'};
}
export const usedTrialReply='Você já utilizou o teste grátis da Aperte Play. Liberamos apenas um teste por contato. 🙂\n\nPara continuar, veja os planos: https://www.aperteoplayiptv.com.br/comprar\nSe precisar de ajuda para instalar ou acessar, responda *ajuda*.';
export const pendingTrialReply='Sua solicitação de teste já foi registrada. Não será criado outro acesso. Aguarde a conclusão; se precisar de ajuda, responda *ajuda*.';
export type TrialDependencies={
  reserve:(keys:string[])=>Promise<{id:string;fresh:boolean;state:string}>;
  mark:(id:string,state:'creating'|'created'|'uncertain',customerId?:string)=>Promise<void>;
  create:(input:{id:string;phone?:string;name:string})=>Promise<{id:string;reply:string}>;
};
export async function limitedTrial(body:unknown,secret:string,deps:TrialDependencies) {
  const sender=trialSender(body);
  if(!sender) {
    console.warn('trial_sender_unidentified',JSON.stringify(trialPayloadShape(body)));
    return {reply:'Não consegui identificar seu contato para liberar o teste com segurança. Responda *ajuda*.'};
  }
  const record=await deps.reserve(sender.ids.map(id=>trialHash(id,secret)));
  if(!record.fresh) return {reply:record.state==='created'||record.state==='historical'?usedTrialReply:pendingTrialReply};
  // Commit BEFORE the external request. Timeout/crash must never reopen eligibility.
  await deps.mark(record.id,'creating');
  try {
    const result=await deps.create({id:record.id,phone:sender.phone,name:sender.name});
    await deps.mark(record.id,'created',result.id);
    return {reply:result.reply};
  } catch {
    await deps.mark(record.id,'uncertain').catch(()=>{});
    return {reply:pendingTrialReply};
  }
}
