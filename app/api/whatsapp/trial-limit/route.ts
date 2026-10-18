import {createHmac,timingSafeEqual} from 'node:crypto';
import {database} from '../../../../lib/payments/repository';
import {hash,readJson} from '../../../../lib/payments/security';
import {limitedTrial,trialTagDiagnostic} from '../../../../lib/whatsapp/trial-limit';
import {markLimitedTrial,reserveLimitedTrial,trialSchema} from '../../../../lib/whatsapp/trial-limit-store';
import {checkTrialPackage,createLimitedTrial,prepareTrialHistory} from '../../../../lib/whatsapp/trial-limit-supplier';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function secretFor(request:Request) {
  const secret=process.env.WHATSAPP_BOT_SECRET??'';
  const key=createHmac('sha256',secret).update('trial-limit-endpoint-v1').digest('hex');
  const supplied=new URL(request.url).searchParams.get('k')??'';
  return secret.length>=24&&timingSafeEqual(Buffer.from(hash(key)),Buffer.from(hash(supplied)))?secret:null;
}
async function prepared() {
  await trialSchema();
  const db=database();
  await db`CREATE TABLE IF NOT EXISTS aperte_trial_limit_setup (id integer PRIMARY KEY CHECK(id=1), prepared_at timestamptz NOT NULL DEFAULT now())`;
  await db`REVOKE ALL ON aperte_trial_limit_setup FROM PUBLIC`;
  await db`ALTER TABLE aperte_trial_limit_setup ENABLE ROW LEVEL SECURITY`;
  const rows=await db`SELECT id FROM aperte_trial_limit_setup WHERE id=1`;
  return rows.length===1;
}
export async function GET(request:Request) {
  if(!secretFor(request)) return json({error:'unauthorized'},401);
  try {
    const ready=await prepared();
    const states=await database()`SELECT state,count(*)::int AS total FROM aperte_trial_limits GROUP BY state`;
    return json({ready,states});
  } catch{return json({ready:false},503);}
}
export async function POST(request:Request) {
  const secret=secretFor(request);
  if(!secret) return json({error:'unauthorized'},401);
  try {
    if(new URL(request.url).searchParams.get('mode')==='prepare') {
      await prepared();
      await checkTrialPackage();
      const summary=await prepareTrialHistory(secret);
      await database()`INSERT INTO aperte_trial_limit_setup(id) VALUES(1) ON CONFLICT DO NOTHING`;
      return json({ready:true,...summary});
    }
    if(!await prepared()) return json({error:'not_prepared'},503);
    const body=await readJson(request,16000);
    const tag=new URL(request.url).searchParams.get('contact_probe');
    if(tag!==null) console.info('trial_contact_tag',JSON.stringify(trialTagDiagnostic(tag,body,secret)));
    return json(await limitedTrial(body,secret,{reserve:reserveLimitedTrial,mark:markLimitedTrial,create:createLimitedTrial}));
  } catch {
    console.error('trial_limit_unavailable');
    return json({reply:'Não foi possível concluir a solicitação agora. Para evitar duplicidade, não geramos outro teste. Responda *ajuda* para verificar.'},503);
  }
}
