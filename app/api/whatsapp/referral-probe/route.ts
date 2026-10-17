import {createHmac,timingSafeEqual} from 'node:crypto';
import {database} from '../../../../lib/payments/repository';
import {hash,readJson} from '../../../../lib/payments/security';
import {probeUntil,referralSummary} from '../../../../lib/whatsapp/referral-probe';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=15;
let ready: Promise<unknown> | undefined;
const response=(status=200)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
// Deliberately no import of bot, answer, send, fulfillment, supplier or payment mutations.
export async function POST(request: Request) {
  const secret=process.env.BOTBOT_AUTH_KEY ?? '';
  const supplied=new URL(request.url).searchParams.get('k') ?? '';
  const probeKey=createHmac('sha256',secret).update('passive-referral-probe-v1').digest('hex');
  if(secret.length<24 || !timingSafeEqual(Buffer.from(hash(probeKey)),Buffer.from(hash(supplied)))) return response(401);
  if(Date.now()>probeUntil) return response();
  let body:unknown;
  try {body=await readJson(request,60000);} catch {return response();}
  const summary=referralSummary(body,secret);
  try {
    const db=database();
    ready ??= db.unsafe(`CREATE TABLE IF NOT EXISTS aperte_referral_probe (
      id bigserial PRIMARY KEY, received_at timestamptz NOT NULL DEFAULT now(), summary jsonb NOT NULL);
      REVOKE ALL ON aperte_referral_probe FROM PUBLIC;
      ALTER TABLE aperte_referral_probe ENABLE ROW LEVEL SECURITY;`).catch(e=>{ready=undefined;throw e;});
    await ready;
    await db`INSERT INTO aperte_referral_probe(summary) SELECT ${db.json(summary)} WHERE (SELECT count(*) FROM aperte_referral_probe)<500`;
  } catch {console.error('referral_probe_store_failed'); return response(503);}
  return response();
}
