import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
// Run after test:payments, which transpiles all payment modules. No external requests.
const require=createRequire(new URL('../outputs/payment-tests/tests.cjs',import.meta.url));
const meta=require('./lib/payments/meta-conversions.js');
const repo=require('./lib/payments/repository.js');
const order={id:'00000000-0000-4000-8000-000000000001',mode:'production',status:'approved',phone:'33984622431',email:'TEST@example.invalid',amount_cents:2500,plan_id:'mensal'};
const attribution={consent:true,fbp:'fb.1.100.123'};
const event=meta.purchasePayload(order,attribution,'Test browser',123456);
assert.equal(event.custom_data.value,25);assert.equal(event.custom_data.currency,'BRL');
assert.equal(event.event_id,meta.purchasePayload(order,attribution,'x',123456).event_id);
assert.match(event.user_data.em[0],/^[a-f0-9]{64}$/);assert.match(event.user_data.ph[0],/^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(event).includes('TEST@example'),false);
for(const status of ['created','pending','authorized','refunded','charged_back','rejected'])assert.equal(meta.purchasePayload({...order,status},attribution,'x',1),null);
assert.equal(meta.purchasePayload({...order,mode:'test'},attribution,'x',1),null);
assert.equal(meta.purchasePayload(order,{consent:false},'x',1),null);
process.env.META_TRACKING_ENABLED='true';process.env.META_PIXEL_ID='123';process.env.META_CAPI_ACCESS_TOKEN='synthetic';
let saved=true,claimed=false,sent=false,requests=0,fail=false;const ids=[];
const db=async(parts)=>{const sql=parts.join('?');
  if(sql.startsWith('UPDATE') && sql.includes('RETURNING')){if(!saved||claimed||sent)return [];claimed=true;return [{attribution,user_agent:'test',event_time:123456}];}
  if(sql.includes('SET sent_at')){sent=true;claimed=false;return [];}
  if(sql.includes('SET claimed_at=NULL')){claimed=false;return [];}
  if(sql.startsWith('DELETE')){saved=false;return [];}
  throw new Error('Unexpected query');};
db.unsafe=async()=>[];repo.database=()=>db;
globalThis.fetch=async(url,options)=>{requests++;ids.push(JSON.parse(options.body).data[0].event_id);await new Promise(resolve=>setTimeout(resolve,10));if(fail)throw Error('simulated timeout');return {ok:true,json:async()=>({events_received:1})};};
await Promise.all([meta.sendPurchase(order),meta.sendPurchase(order)]);assert.equal(requests,1);
await meta.sendPurchase(order);assert.equal(requests,1);
sent=false;fail=true;await meta.sendPurchase(order);fail=false;await meta.sendPurchase(order);assert.equal(requests,3);assert.equal(new Set(ids).size,1);
sent=false;await meta.revokeAttribution('synthetic-session');await meta.sendPurchase(order);assert.equal(requests,3);
console.log('Meta checks passed: paid only, consent, test exclusion, BRL amount, hashing, concurrent/repeated notifications, stable retry id and revocation. Synthetic fixtures only.');
