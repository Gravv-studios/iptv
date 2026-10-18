import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const output=new URL('../outputs/trial-limit-tests/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('package.json',output),'{"type":"commonjs"}');
const source=await readFile(new URL('../lib/whatsapp/trial-limit.ts',import.meta.url),'utf8');
await writeFile(new URL('trial-limit.cjs',output),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const {trialIdentity,trialSender,limitedTrial,trialHash,trialTagDiagnostic}=createRequire(import.meta.url)(new URL('trial-limit.cjs',output).pathname.replace(/^\/([A-Z]:)/,'$1'));
assert.equal(trialIdentity('+55 (61) 98443-4197'),trialIdentity('556184434197@s.whatsapp.net'));
assert.equal(trialIdentity('111372964724779@lid'),'lid:111372964724779');
assert.equal(trialIdentity('111372964724779'),null);
assert.equal(trialIdentity('12000000000@g.us'),null);
assert.equal(trialSender({senderMessage:'teste',devicePhone:'5561984434197'}),null);
assert.equal(trialSender({senderPhone:'5561984434197',senderJid:'5511999999999'}),null);
const secret='synthetic-not-a-real-secret';
assert.equal(trialTagDiagnostic('{phone_number}',{},secret).unresolved,true);
assert.equal(trialTagDiagnostic('5561984434197',{devicePhone:'556184434197'},secret).sameAsDevice,true);
const tagDiagnostic=trialTagDiagnostic('123456789012345@lid',{},secret);
assert.equal(tagDiagnostic.kind,'lid');
assert.equal(tagDiagnostic.fingerprint,trialHash('lid:123456789012345',secret));
assert.ok(!JSON.stringify(tagDiagnostic).includes('123456789012345'));
const records=new Map(); let calls=0;
const deps={
 async reserve(keys){let row=keys.map(k=>records.get(k)).find(Boolean);if(row)return {...row,fresh:false};row={id:keys[0],state:'reserved'};for(const k of keys)records.set(k,row);return {...row,fresh:true};},
 async mark(id,state){for(const r of records.values())if(r.id===id)r.state=state;},
 async create(){calls++;await new Promise(r=>setTimeout(r,10));return {id:'synthetic-customer',reply:'synthetic-access'};}
};
const body={senderPhone:'5561984434197',senderName:'Teste sintético'};
const replies=await Promise.all(Array.from({length:30},()=>limitedTrial(body,secret,deps)));
assert.equal(calls,1);assert.equal(replies.filter(r=>r.reply==='synthetic-access').length,1);
await limitedTrial({senderPhone:'556184434197'},secret,deps);assert.equal(calls,1);
await limitedTrial({...body,senderLid:'123456789012345@lid'},secret,{...deps,reserve:async keys=>{const r=await deps.reserve(keys);for(const k of keys)records.set(k,{id:r.id,state:r.state});return r;}});
await limitedTrial({senderPhone:'123456789012345@lid'},secret,deps);assert.equal(calls,1);
records.clear();calls=0;
const timeout={...deps,create:async()=>{calls++;throw Error('lost response after creation');}};
await limitedTrial(body,secret,timeout);await limitedTrial(body,secret,timeout);assert.equal(calls,1);
records.clear();calls=0;
records.set(trialHash('phone:5561984434197',secret),{id:'historical',state:'historical'});
await limitedTrial(body,secret,deps);assert.equal(calls,0);
let creatingMarked=false;
await limitedTrial({senderPhone:'5511988887777'},secret,{reserve:async()=>({id:'x',fresh:true,state:'reserved'}),mark:async(_id,state)=>{if(state==='creating'){creatingMarked=true;throw Error('database offline');}},create:async()=>{throw Error('MUST NOT CREATE');}}).catch(e=>assert.equal(e.message,'database offline'));
assert.ok(creatingMarked);
console.log('OK: normalização, LID separado, origem válida, 30 solicitações concorrentes, histórico, resposta perdida e falha no banco. Nenhuma chamada real ou mensagem enviada.');
