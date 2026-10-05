import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Exercise the domain without resetting or modifying the presentation account.
const compile = source => ts.transpileModule(source, {
  compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText;
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const offerUrl = moduleUrl(compile(await readFile(new URL('../lib/offer.ts',import.meta.url),'utf8')));
const domainCode = compile(await readFile(new URL('../lib/domain.ts',import.meta.url),'utf8'))
  .replace("from './offer'",`from '${offerUrl}'`);
const domain = await import(moduleUrl(domainCode));
const offer = await import(offerUrl);

assert.deepEqual(domain.plans.map(p=>[p.id,p.period,p.amount]),[
  ['mensal','1 mês',2500],['semestral','6 meses',10000],['anual','12 meses',17000],
]);
assert.equal(domain.getPlan('trimestral'),undefined,'Retired plan is not for sale.');
assert.equal(domain.getPlan('anual').days,365,'Annual demo provisioning duration.');

const previousSemester = domain.orderPlan({plan_id:'semestral',amount:14990,days:180});
assert.equal(previousSemester.amount,14990,'A changed catalog price must not reprice an existing order.');
assert.equal(previousSemester.period,'6 meses');
const retiredQuarter = domain.orderPlan({plan_id:'trimestral',amount:7990,days:90});
assert.equal(retiredQuarter.name,'Aperte Play Trimestral','Old plan remains identifiable in history.');
assert.equal(retiredQuarter.amount,7990);
assert.equal(retiredQuarter.days,90);
assert.equal(domain.orderPlan({plan_id:'mensal',amount:2500,days:28}).period,'28 dias','Custom historical duration stays accurate.');

const url=new URL(offer.trialUrl);
assert.equal(url.hostname,'wa.me');
assert.equal(url.pathname,'/5533984622431');
assert.equal(offer.trialHours,6);
assert.match(url.searchParams.get('text'),/teste grátis de 6 horas/);
assert.match(domain.assistantReply('Quero testar grátis',domain.preview().account),/6 horas/);
assert.equal(offer.trialUrlForDevice(null),offer.trialUrl,'Choosing a device is optional.');
for (const [device, text] of [['tv','na minha Smart TV'],['mobile','no meu celular ou tablet'],['computer','no meu computador']]) {
  const request = new URL(offer.trialUrlForDevice(device));
  assert.equal(request.origin + request.pathname,'https://wa.me/5533984622431','Device choice keeps the approved contact.');
  assert.ok(request.searchParams.get('text').includes(text),'The request includes the selected device.');
  assert.match(request.searchParams.get('text'),/teste grátis de 6 horas/,'The offer stays unchanged.');
}
console.log('24 checks passed: prices, history, six-hour trial and optional device-specific WhatsApp messages. No account data changed.');
