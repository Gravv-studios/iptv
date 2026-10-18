import {randomUUID} from 'node:crypto';
import {database} from '../payments/repository';
let ready:Promise<unknown>|undefined;
export async function trialSchema() {
  const db=database();
  ready??=db.unsafe(`CREATE TABLE IF NOT EXISTS aperte_trial_limits (
    id uuid PRIMARY KEY, state text NOT NULL, customer_id text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS aperte_trial_identities (
    identity_hash text PRIMARY KEY, trial_id uuid NOT NULL REFERENCES aperte_trial_limits(id));
    REVOKE ALL ON aperte_trial_limits, aperte_trial_identities FROM PUBLIC;
    ALTER TABLE aperte_trial_limits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE aperte_trial_identities ENABLE ROW LEVEL SECURITY;`).catch(e=>{ready=undefined;throw e;});
  await ready;
}
export async function reserveLimitedTrial(keys:string[],historicalCustomer?:string) {
  await trialSchema();
  return database().begin(async tx=>{
    for(const key of [...keys].sort()) await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
    const existing=await tx`SELECT t.* FROM aperte_trial_limits t JOIN aperte_trial_identities i ON i.trial_id=t.id WHERE i.identity_hash IN ${tx(keys)} ORDER BY t.created_at LIMIT 1`;
    const id=existing[0]?.id??randomUUID();
    const state=existing[0]?.state??(historicalCustomer?'historical':'reserved');
    if(!existing[0]) await tx`INSERT INTO aperte_trial_limits(id,state,customer_id) VALUES(${id},${state},${historicalCustomer??null})`;
    for(const key of keys) await tx`INSERT INTO aperte_trial_identities(identity_hash,trial_id) VALUES(${key},${id}) ON CONFLICT DO NOTHING`;
    return {id:id as string,state:state as string,fresh:!existing[0]&&!historicalCustomer};
  });
}
export async function markLimitedTrial(id:string,state:'creating'|'created'|'uncertain',customerId?:string) {
  await database()`UPDATE aperte_trial_limits SET state=${state},customer_id=COALESCE(${customerId??null},customer_id),updated_at=now() WHERE id=${id}`;
}
