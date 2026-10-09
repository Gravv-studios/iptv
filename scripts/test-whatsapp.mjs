import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Synthetic fixtures only. No database, credentials, supplier calls, messages or real charges.
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'outputs/whatsapp-tests');
await mkdir(output, {recursive: true});
await writeFile(path.join(output, 'package.json'), '{"type":"commonjs"}');
async function compile(relative) {
  const target = path.join(output, relative.replace(/\.tsx?$/, '.js'));
  await mkdir(path.dirname(target), {recursive: true});
  await writeFile(target, ts.transpileModule(await readFile(path.join(root, relative), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText);
}
for (const dir of ['lib/payments','lib/whatsapp']) for (const file of await readdir(path.join(root, dir))) if (file.endsWith('.ts')) await compile(dir + '/' + file);
for (const file of ['lib/domain.ts','lib/offer.ts','app/api/whatsapp/bot/route.ts','app/api/payments/webhook/route.ts']) await compile(file);
const require = createRequire(path.join(output, 'tests.cjs'));
const bot = require('./lib/whatsapp/bot.js');
const sigma = require('./lib/whatsapp/sigma.js');
const store = require('./lib/whatsapp/store.js');
const fulfill = require('./lib/whatsapp/fulfill.js');
const botbot = require('./lib/whatsapp/botbot.js');
const provider = require('./lib/payments/mercado-pago.js');
const repository = require('./lib/payments/repository.js');
const security = require('./lib/payments/security.js');

globalThis.fetch = async () => { throw new Error('Unexpected outbound request in offline test'); };
const env = {PAYMENTS_ENABLED:'true',MP_MODE:'test',MP_PUBLIC_KEY:'SYNTHETIC-public',MP_ACCESS_TOKEN:'SYNTHETIC-private',MP_COLLECTOR_ID:'42',MP_WEBHOOK_SECRET:'SYNTHETIC-secret',PAYMENTS_SESSION_SECRET:'synthetic-session-secret-at-least-32-chars',DATABASE_URL:'postgres://test:test@localhost/test',APP_URL:'https://www.example.invalid',
  SIGMA_API_URL:'https://supplier.invalid/api/reseller-api/v1',SIGMA_API_TOKEN:'SYNTHETIC-sigma',BOTBOT_APP_KEY:'SYNTHETIC-app',BOTBOT_AUTH_KEY:'SYNTHETIC-auth',WHATSAPP_BOT_SECRET:'synthetic-bot-secret-0123456789',WHATSAPP_ADMIN:'5500000000000'};
for (const key of Object.keys(env)) delete process.env[key];
let total = 0;
async function check(name, fn) { await fn(); total++; console.log('OK ' + name); }
async function patch(target, overrides, run) {
  const original = Object.fromEntries(Object.keys(overrides).map(key => [key, target[key]]));
  Object.assign(target, overrides);
  try { await run(); } finally {Object.assign(target, original);}
}
const day = 86400000, now = Date.parse('2026-10-08T22:00:00Z');
const iso = offset => new Date(now + offset).toISOString();
const pkg = (id, name, extra = {}) => ({id, server_id: 'srv1', server: 'PRIMELUX SERVER 💎', name, status: 'ACTIVE', is_trial: 'NO', is_adult: false, duration: 1, duration_in: 'MONTHS', ...extra});
const catalog = [
  pkg('t1', '🔷 TESTE IPTV COMPLETO S/ ADULTOS 🔷', {is_trial: 'YES'}), pkg('t2', '🔷 TESTE IPTV COMPLETO C/ ADULTOS 🔷', {is_trial: 'YES', is_adult: true}),
  pkg('t3', '🔴🔷TESTE UNI TV COMPLETO S/ ADULTOS 🔷🔴', {is_trial: 'YES'}),
  pkg('m1', 'MENSAL S/ ADULTOS'), pkg('m2', 'MENSAL C/ ADULTOS', {is_adult: true}), pkg('s1', 'SEMESTRAL S/ ADULTOS'), pkg('a1', 'ANUAL S/ ADULTOS'),
  pkg('x1', 'MENSAL SEM ADULTOS', {server: 'P2P BINSTREAM', server_id: 'srv2'}),
];
const packages = sigma.pickPackages(catalog, 'PRIMELUX SERVER');
const orderId = randomUUID();
const order = {id: orderId, request_key: randomUUID(), session_hash: 'private-hash', plan_id: 'mensal', plan_name: 'Aperte Play Mensal', period: '1 mês', amount_cents: 2500, customer_name: 'Cliente Teste', email: 'cliente.abc@example.invalid', phone: '5531999990000', mode: 'test', status: 'approved', payment_id: 'PAY01JS2V6CM8KJ0EC4H504R7YE34', provider_order_id: 'ORD01JS2V6CM8KJ0EC4H502TGK1WP', payment_instructions: null, submission_hash: 'fingerprint', provider_updated_at: null, fulfillment: 'awaiting_activation', created_at: iso(-60000), updated_at: iso(0)};
const trialCustomer = {id: 'c1', username: 'user1', password: 'pass1', expires_at: iso(5 * 3600000), status: 'ACTIVE', is_trial: 'YES', package: 'TESTE', package_id: 't1', m3u_url: 'http://server.invalid:80/get.php?username=user1'};
const message = text => ({sender: '5531999990000', name: 'Cliente Teste', text, at: 1791496000});

await check('BotBot payload is bounded and the intent comes from the customer words', () => {
  assert.equal(bot.parseMessage({senderPhone: '', senderMessage: 'teste'}), null);
  assert.equal(bot.parseMessage({senderPhone: '55319', senderMessage: ''}), null);
  const parsed = bot.parseMessage({senderPhone: '184467440737095@lid', senderName: '<b>Ana</b>', senderMessage: 'x'.repeat(900), messageDateTime: 1791496000});
  assert.equal(parsed.sender, '184467440737095@lid'); assert.equal(parsed.text.length, 400); assert.doesNotMatch(parsed.name, /[<>]/); assert.equal(parsed.at, 1791496000);
  assert.equal(bot.parseMessage({senderPhone: '1', senderMessage: 'a', senderName: 'A'}).name, 'Cliente WhatsApp');
  const kind = text => bot.intentOf(text).kind;
  assert.deepEqual(bot.intentOf('Quero o plano SEMESTRAL'), {kind: 'plan', plan: 'semestral'});
  assert.deepEqual(bot.intentOf('anual por favor'), {kind: 'plan', plan: 'anual'});
  assert.equal(kind('Já paguei'), 'paid'); assert.equal(kind('quero pagar'), 'pay'); assert.equal(kind('como faço o pix?'), 'pay');
  assert.equal(kind('Olá! Quero solicitar o teste grátis de 5 horas da Aperte Play.'), 'trial'); assert.equal(kind('Teste Gratis'), 'trial');
  assert.equal(kind('boa noite'), 'help'); assert.equal(kind('mensalidade'), 'help');
});
await check('packages resolve only to the no-adult catalog of the configured server', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(packages).map(([key, value]) => [key, value.id])), {trial: 't1', mensal: 'm1', semestral: 's1', anual: 'a1'});
  assert.throws(() => sigma.pickPackages([...catalog, pkg('m9', 'MENSAL S/ ADULTOS')], 'PRIMELUX SERVER'), {code: 'PACKAGE_NOT_RESOLVED'});
  assert.throws(() => sigma.pickPackages(catalog.filter(p => p.id !== 'a1'), 'PRIMELUX SERVER'), {code: 'PACKAGE_NOT_RESOLVED'});
  assert.throws(() => sigma.pickPackages(catalog, 'OUTRO SERVIDOR'), {code: 'PACKAGE_NOT_RESOLVED'});
  assert.equal(sigma.pickPackages(catalog, 'PRIMELUX SERVER', {mensal: 'x1'}).mensal.id, 'x1');
});
await check('a paid period counts only when it is added on top of what the customer had', () => {
  const paidUntil = offset => ({...trialCustomer, is_trial: 'NO', expires_at: iso(offset)});
  assert.equal(fulfill.gained(trialCustomer, trialCustomer, 30, now), false);
  assert.equal(fulfill.gained(trialCustomer, paidUntil(31 * day), 30, now), true);
  assert.equal(fulfill.gained(trialCustomer, paidUntil(5 * 3600000), 30, now), false);
  // A renewal with 40 days left must reach about 70 days, not stay at 40.
  assert.equal(fulfill.gained(paidUntil(40 * day), paidUntil(40 * day), 30, now), false);
  assert.equal(fulfill.gained(paidUntil(40 * day), paidUntil(70 * day), 30, now), true);
  assert.equal(fulfill.gained(paidUntil(-3 * day), paidUntil(30 * day), 30, now), true);
  assert.equal(fulfill.gained(null, paidUntil(365 * day), 365, now), true);
  assert.equal(fulfill.gained(null, {...paidUntil(0), expires_at: null}, 30, now), false);
});
await check('bot Pix body carries the server price and no card or document data', () => {
  const body = provider.pixBody({...order, status: 'created'});
  assert.equal(body.total_amount, '25.00'); assert.equal(body.external_reference, orderId);
  assert.deepEqual(body.transactions.payments[0], {amount: '25.00', payment_method: {id: 'pix', type: 'bank_transfer'}, expiration_time: 'PT30M'});
  assert.deepEqual(body.payer, {email: order.email, first_name: 'Cliente', last_name: 'Teste'});
});
const route = () => require('./app/api/whatsapp/bot/route.js');
const post = (query, body = {senderPhone: '5531999990000', senderName: 'Cliente Teste', senderMessage: 'oi'}) => route().POST(new Request('https://www.example.invalid/api/whatsapp/bot' + query, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}));
await check('endpoint refuses callers before configuration or without the shared secret', async () => {
  assert.equal((await post('?k=synthetic-bot-secret-0123456789')).status, 401);
  Object.assign(process.env, env);
  for (const query of ['', '?k=', '?k=wrong', '?k=synthetic-bot-secret-012345678']) assert.equal((await post(query)).status, 401);
  const response = await post('?k=synthetic-bot-secret-0123456789');
  assert.equal(response.status, 200); assert.match((await response.json()).reply, /teste/);
});
await check('supplier or database failures answer a neutral message without leaking details', async () => {
  await patch(store, {findContact: async () => { throw new Error('postgres://user:secret@host SYNTHETIC-sigma'); }}, async () => {
    const response = await post('?k=synthetic-bot-secret-0123456789', {senderPhone: '5531999990000', senderMessage: 'teste'});
    const text = await response.text();
    assert.equal(response.status, 200); assert.match(text, /indisponível/); assert.doesNotMatch(text, /postgres|SYNTHETIC|secret@/);
  });
});
await check('each number gets one free trial and later requests only show its status', async () => {
  let created = 0, contact, reserved = false;
  await patch(sigma, {resolvePackages: async () => packages, createCustomer: async (target, input) => { created++; assert.equal(target.id, 't1'); assert.equal(input.trialHours, 5); assert.equal(input.whatsapp, '5531999990000'); return trialCustomer; }, getCustomer: async id => { assert.equal(id, 'c1'); return trialCustomer; }}, async () => {
    await patch(store, {findContact: async () => contact, reserveTrial: async () => { if (reserved) return undefined; reserved = true; return {sender: 's'}; }, saveCustomer: async (sender, name, id) => { contact = {sender, sender_name: name, customer_id: id, trial_at: iso(0)}; }, releaseTrial: async () => { reserved = false; }}, async () => {
      const first = await bot.reply(message('teste grátis'), null);
      assert.match(first, /user1/); assert.match(first, /pass1/); assert.match(first, /http:\/\/server\.invalid/); assert.doesNotMatch(first, /get\.php|PRIMELUX/i);
      assert.match(await bot.reply(message('quero outro teste'), null), /já tem um teste/);
      assert.equal(created, 1);
    });
  });
});
await check('a failed trial creation releases the reservation instead of burning the trial', async () => {
  let released = 0;
  await patch(sigma, {resolvePackages: async () => packages, createCustomer: async () => { throw new sigma.SigmaError(422, 'invalid'); }}, async () => {
    await patch(store, {findContact: async () => undefined, reserveTrial: async () => ({sender: 's'}), releaseTrial: async () => { released++; }}, async () => {
      await assert.rejects(bot.reply(message('teste'), null), /invalid/);
      assert.equal(released, 1);
    });
  });
  await patch(store, {findContact: async () => undefined, reserveTrial: async () => undefined}, async () => assert.match(await bot.reply(message('teste'), null), /já foi solicitado/));
});
const pending = {...order, status: 'pending', fulfillment: 'awaiting_payment', payment_instructions: {kind: 'pix', qrCode: '000201SYNTHETICPIX'}};
await check('the two reply blocks share one order and return the intro and the bare Pix code', async () => {
  let createdOrders = 0, submissions = 0, linked = 0, current;
  await patch(provider, {getVerifiedAccount: async () => ({id: '42', mode: 'test'}), submitPayment: async reserved => { submissions++; current = {...pending, id: reserved.id}; return current; }}, async () => {
    await patch(repository, {createOrder: async (input, owner, mode) => { createdOrders++; assert.equal(input.planId, 'mensal'); assert.match(input.requestKey, /^[0-9a-f-]{36}$/); assert.match(input.email, /^cliente\.[0-9a-f]{12}@example\.invalid$/); assert.equal(input.phone, '5531999990000'); assert.equal(owner, security.hash('wa:5531999990000')); assert.equal(mode, 'test'); current = {...order, status: 'created', submission_hash: null, fulfillment: 'awaiting_payment', created_at: new Date().toISOString()}; return current; },
      reserveSubmission: async id => ({...current, id, submission_hash: 'reserved'}), findOrder: async () => current}, async () => {
      await patch(store, {latestOrder: async () => current && {...current, created_at: new Date().toISOString()}, linkOrder: async () => { linked++; }}, async () => {
        const intro = await bot.reply(message('mensal'), '1');
        assert.match(intro, /Aperte Play Mensal/); assert.match(intro, /R\$\s?25,00/); assert.doesNotMatch(intro, /000201/);
        assert.equal(await bot.reply(message('mensal'), '2'), '000201SYNTHETICPIX');
        assert.match(await bot.reply(message('mensal'), null), /copia e cola[\s\S]*000201SYNTHETICPIX$/);
        assert.equal(createdOrders, 1); assert.equal(submissions, 1); assert.equal(linked, 1);
      });
    });
  });
});
await check('a charge that cannot be generated never returns a fake code', async () => {
  await patch(provider, {getVerifiedAccount: async () => ({id: '42', mode: 'test'}), submitPayment: async () => ({...order, status: 'rejected'})}, async () => {
    await patch(repository, {createOrder: async () => ({...order, status: 'created', submission_hash: null}), reserveSubmission: async () => order}, async () => {
      await patch(store, {latestOrder: async () => undefined, linkOrder: async () => {}}, async () => {
        assert.match(await bot.reply(message('anual'), '1'), /Não consegui gerar o Pix/);
        assert.equal(await bot.reply(message('anual'), '2'), '');
        assert.equal(await bot.reply(message('quero pagar'), '2'), '');
      });
    });
  });
});
const link = {order_id: orderId, sender: '5531999990000', claimed_at: null, activated_at: null, notified_at: null, error: null};
const paidCustomer = {...trialCustomer, is_trial: 'NO', package_id: 'm1', expires_at: new Date(Date.now() + 31 * day).toISOString()};
async function withFulfillment(overrides, run) {
  const calls = [], state = {failed: null, activated: 0, admin: [], sent: []};
  const defaults = {
    store: {findLink: async () => link, findContact: async () => ({sender: link.sender, sender_name: 'Cliente', customer_id: 'c1', trial_at: null}), claimActivation: async () => true, markActivated: async () => { state.activated++; }, markFailed: async (_id, reason) => { state.failed = reason; }, saveCustomer: async () => { calls.push('save'); }, claimNotice: async () => true},
    sigma: {resolvePackages: async () => packages, getCustomer: async () => { calls.push('get'); return trialCustomer; }, changePackage: async (id, packageId) => { calls.push('package:' + packageId); return paidCustomer; }, renewCustomer: async () => { calls.push('renew'); return paidCustomer; }, createCustomer: async target => { calls.push('create:' + target.id); return paidCustomer; }},
    botbot: {notifyAdmin: async text => { state.admin.push(text); return true; }, sendText: async (to, text) => { state.sent.push([to, text]); return true; }},
  };
  await patch(store, {...defaults.store, ...overrides.store}, () => patch(sigma, {...defaults.sigma, ...overrides.sigma}, () => patch(botbot, {...defaults.botbot, ...overrides.botbot}, () => run(calls, state))));
}
await check('an approved bot order converts the trial once and does not renew twice', async () => {
  await withFulfillment({}, async (calls, state) => {
    const result = await fulfill.fulfillOrder(order);
    assert.equal(result.state, 'activated'); assert.deepEqual(calls, ['get', 'package:m1']); assert.equal(state.activated, 1);
  });
  await withFulfillment({sigma: {changePackage: async () => ({...trialCustomer, is_trial: 'NO', package_id: 'm1'})}}, async (calls, state) => {
    assert.equal((await fulfill.fulfillOrder(order)).state, 'activated'); assert.deepEqual(calls, ['get', 'renew']); assert.equal(state.activated, 1);
  });
});
await check('a paying customer renewing the same plan is renewed without a package change', async () => {
  const before = {...paidCustomer, expires_at: new Date(Date.now() + 10 * day).toISOString()};
  await withFulfillment({sigma: {getCustomer: async () => before, changePackage: async () => { throw new Error('must not change package'); }, renewCustomer: async () => ({...before, expires_at: new Date(Date.now() + 40 * day).toISOString()})}}, async (_calls, state) => {
    assert.equal((await fulfill.fulfillOrder(order)).state, 'activated'); assert.equal(state.activated, 1);
  });
});
await check('a buyer without a trial gets a new paid account', async () => {
  await withFulfillment({store: {findContact: async () => undefined}}, async calls => {
    assert.equal((await fulfill.fulfillOrder(order)).state, 'activated'); assert.deepEqual(calls, ['create:m1', 'save']);
  });
});
await check('supplier failure after the claim stops for manual review and warns the admin', async () => {
  await withFulfillment({sigma: {changePackage: async () => { throw new sigma.SigmaError(402, 'Insufficient credits'); }}}, async (_calls, state) => {
    assert.equal((await fulfill.fulfillOrder(order)).state, 'review'); assert.equal(state.activated, 0); assert.match(state.failed, /Insufficient credits/); assert.equal(state.admin.length, 1); assert.match(state.admin[0], new RegExp(orderId));
  });
  await withFulfillment({sigma: {changePackage: async () => trialCustomer, renewCustomer: async () => trialCustomer}}, async (_calls, state) => {
    assert.equal((await fulfill.fulfillOrder(order)).state, 'review'); assert.match(state.failed, /período não aplicado/);
  });
});
await check('repeated deliveries, unpaid orders and site orders never reach the supplier', async () => {
  const forbidden = {sigma: {getCustomer: async () => { throw new Error('supplier must not be called'); }, changePackage: async () => { throw new Error('supplier must not be called'); }, renewCustomer: async () => { throw new Error('supplier must not be called'); }, createCustomer: async () => { throw new Error('supplier must not be called'); }}};
  await withFulfillment({...forbidden, store: {claimActivation: async () => false}}, async () => assert.equal((await fulfill.fulfillOrder(order)).state, 'busy'));
  await withFulfillment({...forbidden, store: {claimActivation: async () => false, findLink: async () => ({...link, error: 'x'})}}, async () => assert.equal((await fulfill.fulfillOrder(order)).state, 'review'));
  await withFulfillment({...forbidden, store: {findLink: async () => undefined}}, async () => assert.equal(await fulfill.fulfillOrder(order), null));
  for (const change of [{status: 'pending'}, {status: 'refunded'}, {fulfillment: 'review_required'}]) await withFulfillment(forbidden, async () => assert.equal(await fulfill.fulfillOrder({...order, ...change}), null));
});
await check('the buyer is told once, and "paguei" answers from the authoritative provider status', async () => {
  await withFulfillment({}, async (_calls, state) => {
    await fulfill.fulfillAndNotify(order);
    assert.equal(state.sent.length, 1); assert.equal(state.sent[0][0], '5531999990000'); assert.match(state.sent[0][1], /Pagamento confirmado[\s\S]*user1/);
  });
  await withFulfillment({store: {findLink: async () => ({...link, notified_at: iso(0)})}}, async (_calls, state) => { await fulfill.fulfillAndNotify(order); assert.equal(state.sent.length, 0); });
  await withFulfillment({store: {latestOrder: async () => pending}}, async () => {
    await patch(provider, {reconcileOrder: async found => found}, async () => assert.match(await bot.reply(message('paguei'), null), /Ainda não recebemos/));
    await patch(provider, {reconcileOrder: async () => order}, async () => assert.match(await bot.reply(message('paguei'), null), /Pagamento confirmado[\s\S]*user1/));
  });
  await withFulfillment({store: {latestOrder: async () => undefined}}, async () => assert.match(await bot.reply(message('paguei'), null), /Não encontrei um pedido/));
});
await check('BotBot send failures are reported as false and never thrown', async () => {
  await patch(globalThis, {fetch: async (url, options) => { assert.equal(url, 'https://botbot.chat/api/v2/sendText'); assert.equal(options.headers.appKey, 'SYNTHETIC-app'); assert.deepEqual(JSON.parse(options.body), {to: '5531', message: 'oi'}); return Response.json({}, {status: 200}); }}, async () => assert.equal(await botbot.sendText('5531', 'oi'), true));
  await patch(globalThis, {fetch: async () => { throw new Error('timeout'); }}, async () => assert.equal(await botbot.sendText('5531', 'oi'), false));
  await patch(globalThis, {fetch: async () => Response.json({}, {status: 500})}, async () => assert.equal(await botbot.sendText('5531', 'oi'), false));
});
await check('supplier calls send the bearer token and surface only short error text', async () => {
  await patch(globalThis, {fetch: async (url, options) => { assert.equal(url, 'https://supplier.invalid/api/reseller-api/v1/customers/c%2F1/renew'); assert.equal(options.method, 'POST'); assert.equal(options.headers.Authorization, 'Bearer SYNTHETIC-sigma'); assert.equal(options.redirect, 'error'); return Response.json({data: paidCustomer}); }}, async () => assert.equal((await sigma.renewCustomer('c/1')).username, 'user1'));
  await patch(globalThis, {fetch: async () => Response.json({message: 'Insufficient credits to perform the operation.'}, {status: 402})}, async () => assert.rejects(sigma.renewCustomer('c1'), error => error.status === 402 && /Insufficient credits/.test(error.message) && !/SYNTHETIC/.test(error.message)));
  await patch(globalThis, {fetch: async () => Response.json({data: {}})}, async () => assert.rejects(sigma.getCustomer('c1'), /resposta sem cliente/));
});
const hook = change => ({event: 'message', messageId: 'MSG-1', from: '553199990000', message: 'teste', messageType: 'text', timestamp: 1791496000, deviceName: 'Aperte Play', devicePhone: '553384622431', ...change});
await check('device webhook answers only private text messages from a real number', () => {
  assert.deepEqual(bot.parseHook(hook({})), {id: 'MSG-1', sender: '553199990000', name: 'Cliente WhatsApp', text: 'teste', at: 1791496000});
  for (const change of [{event: 'message_sent'}, {messageType: 'image'}, {message: '  '}, {messageId: ''}, {from: '120363000000000000@g.us'}, {from: '184467440737095@lid'}, {from: '553384622431'}, {from: undefined}]) assert.equal(bot.parseHook(hook(change)), null);
  assert.equal(bot.parseHook(null), null);
});
await check('webhook answers go through the BotBot API once per message, with the Pix code alone in its own message', async () => {
  const sent = [];
  let claims = 0;
  await patch(botbot, {sendText: async (to, text) => { sent.push([to, text]); return true; }}, async () => {
    await patch(store, {claimMessage: async () => ++claims === 1, latestOrder: async () => ({...pending, created_at: new Date().toISOString()})}, async () => {
      assert.equal(await bot.answer({...bot.parseHook(hook({message: 'quero o mensal'}))}), true);
      assert.equal(sent.length, 2); assert.equal(sent[0][0], '553199990000'); assert.match(sent[0][1], /Aperte Play Mensal/); assert.equal(sent[1][1], '000201SYNTHETICPIX');
      assert.equal(await bot.answer({...bot.parseHook(hook({message: 'quero o mensal'}))}), false);
      assert.equal(sent.length, 2);
    });
    await patch(store, {claimMessage: async () => { throw new Error('ordinary chat must not touch the database'); }}, async () => {
      assert.equal(await bot.answer({...bot.parseHook(hook({message: 'boa noite, tudo bem?'}))}), false);
      assert.equal(sent.length, 2);
    });
    await patch(store, {claimMessage: async () => true, findContact: async () => { throw new Error('database down'); }}, async () => {
      await assert.rejects(bot.answer({...bot.parseHook(hook({message: 'teste'}))}), /database down/);
      assert.equal(sent.length, 3); assert.match(sent[2][1], /indisponível/);
    });
  });
});
console.log(`${total} WhatsApp checks passed. Offline fixtures only; no supplier, message or payment verification.`);
