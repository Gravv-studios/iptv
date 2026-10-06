import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Synthetic fixtures only. No database, credentials, provider calls or real charges.
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'outputs/payment-tests');
await mkdir(output, {recursive: true});
await writeFile(path.join(output, 'package.json'), '{"type":"commonjs"}');
async function compile(relative) {
  const target = path.join(output, relative.replace(/\.ts$/, '.js'));
  const source = await readFile(path.join(root, relative), 'utf8');
  await mkdir(path.dirname(target), {recursive: true});
  await writeFile(target, ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText);
}
for (const file of await readdir(path.join(root, 'lib/payments'))) if (file.endsWith('.ts')) await compile('lib/payments/' + file);
for (const file of ['lib/domain.ts','lib/offer.ts','app/api/checkout/route.ts','app/api/checkout/pay/route.ts','app/api/payments/webhook/route.ts','app/api/checkout/orders/[id]/route.ts']) await compile(file);
const require = createRequire(path.join(output, 'tests.cjs'));
const security = require('./lib/payments/security.js');
const config = require('./lib/payments/config.js');
const validation = require('./lib/payments/validation.js');
const provider = require('./lib/payments/mercado-pago.js');
const {publicOrder} = require('./lib/payments/types.js');
const repository = require('./lib/payments/repository.js');
globalThis.fetch = async () => { throw new Error('Unexpected outbound request in offline test'); };
for (const key of ['PAYMENTS_ENABLED','MP_MODE','MP_PUBLIC_KEY','MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','PAYMENTS_SESSION_SECRET','MP_COLLECTOR_ID','DATABASE_URL','APP_URL','VERCEL']) delete process.env[key];
let total = 0;
async function check(name, fn) { await fn(); total++; console.log('OK ' + name); }
const id = randomUUID();
const order = {id, request_key: randomUUID(), session_hash: 'private-hash', plan_id: 'mensal', plan_name: 'Aperte Play Mensal', period: '1 mês', amount_cents: 2500, customer_name: 'Cliente de Teste', email: 'comprador@example.invalid', phone: '31999990000', mode: 'test', status: 'created', payment_id: null, submission_hash: null, provider_updated_at: null, fulfillment: 'awaiting_payment', created_at: '2026-10-06T12:00:00.000Z', updated_at: '2026-10-06T12:00:00.000Z'};
const raw = {orderId: id, selectedPaymentMethod: 'bank_transfer', formData: {payment_method_id: 'pix', transaction_amount: 0.01, payer: {email: 'different@example.invalid', identification: {type: 'CPF', number: '00000000000'}}, metadata: {app: 'forged'}, status: 'approved'}};
const input = validation.submissionInput.parse(raw);
const receipt = {id: 123456, external_reference: id, metadata: {app: 'aperte-play', order_id: id, plan_id: 'mensal'}, transaction_amount: 25, currency_id: 'BRL', collector_id: 42, live_mode: false, status: 'approved', date_last_updated: '2026-10-06T12:01:00.000Z'};

await check('incomplete or disabled configuration cannot enable charges', () => {
  assert.equal(config.paymentConfig().ready, false);
  assert.throws(config.requirePaymentConfig, {code: 'PAYMENTS_NOT_CONFIGURED'});
  process.env.PAYMENTS_ENABLED = 'true';
  assert.equal(config.paymentConfig().ready, false);
  process.env.PAYMENTS_ENABLED = 'false';
});
await check('order creation rejects prices and unknown/retired plans from the browser', () => {
  const data = {requestKey: randomUUID(), planId: 'mensal', customerName: ' Cliente Teste ', email: 'TESTE@example.invalid', phone: '(31) 99999-0000'};
  assert.equal(validation.orderInput.parse(data).email, 'teste@example.invalid');
  assert.equal(validation.orderInput.parse(data).phone, '31999990000');
  for (const extra of [{amount: 1}, {planId: 'trimestral'}, {email: 'bad'}, {phone: '1'}]) assert.equal(validation.orderInput.safeParse({...data, ...extra}).success, false);
});
await check('payment payload uses stored price, buyer email, reference and metadata', () => {
  const body = provider.paymentBody(order, input, 'https://example.invalid');
  assert.equal(body.transaction_amount, 25);
  assert.equal(body.payer.email, order.email);
  assert.equal(body.external_reference, id);
  assert.deepEqual(body.metadata, receipt.metadata);
  assert.equal(body.notification_url, 'https://example.invalid/api/payments/webhook');
  assert.equal(body.date_of_expiration, '2026-10-06T12:30:00.000Z');
  assert.equal(security.hash(JSON.stringify(body)), security.hash(JSON.stringify(provider.paymentBody(order, input, 'https://example.invalid'))), 'Retries have an identical fingerprint.');
  assert.equal(body.status, undefined);
});
await check('card token is required, wallet blocked, installments limited to one', () => {
  assert.throws(() => validation.validateMethod({...input, selectedPaymentMethod: 'creditCard'}));
  assert.throws(() => validation.validateMethod({...input, formData: {...input.formData, payment_method_id: 'account_money'}}));
  assert.equal(validation.submissionInput.safeParse({...raw, formData: {...raw.formData, installments: 2}}).success, false);
  const card = validation.submissionInput.parse({...raw, selectedPaymentMethod: 'creditCard', formData: {...raw.formData, payment_method_id: 'visa', token: 'test-token-12345', issuer_id: '1', installments: 1}});
  const body = provider.paymentBody(order, card, 'https://example.invalid');
  assert.equal(body.installments, 1); assert.equal(body.issuer_id, 1); assert.equal(body.date_of_expiration, undefined);
});
await check('boleto requires its address and has deterministic expiration', () => {
  const boleto = {...input, selectedPaymentMethod: 'ticket', formData: {...input.formData, payment_method_id: 'bolbradesco'}};
  assert.throws(() => validation.validateMethod(boleto));
  boleto.formData.payer = {...input.formData.payer, address: {zip_code: '00000000', street_name: 'Rua de Teste', street_number: '1', neighborhood: 'Teste', city: 'Teste', federal_unit: 'MG'}};
  assert.equal(provider.paymentBody(order, boleto, 'https://example.invalid').date_of_expiration, '2026-10-07T12:00:00.000Z');
});
await check('valid provider confirmation is accepted', () => assert.deepEqual(validation.verifiedPayment(order, receipt, '42'), {id: '123456', status: 'approved', updatedAt: receipt.date_last_updated, refund: false}));
for (const [name, tamper] of Object.entries({amount: {transaction_amount: 1}, currency: {currency_id: 'USD'}, receiver: {collector_id: 43}, environment: {live_mode: true}, reference: {external_reference: randomUUID()}, metadata: {metadata: {...receipt.metadata, plan_id: 'anual'}}, status: {status: 'invented'}, date: {date_last_updated: 'invalid'}, id: {id: null}})) {
  await check('provider mismatch rejected: ' + name, () => assert.throws(() => validation.verifiedPayment(order, {...receipt, ...tamper}, '42'), {code: 'PAYMENT_MISMATCH'}));
}
await check('a different payment cannot replace an already associated payment', () => assert.throws(() => validation.verifiedPayment({...order, payment_id: 'other'}, receipt, '42'), {code: 'PAYMENT_MISMATCH'}));
await check('partial refunds require review', () => assert.equal(validation.verifiedPayment(order, {...receipt, transaction_amount_refunded: 1}, '42').refund, true));
await check('public order excludes payer details, fingerprints and session ownership', () => {
  const result = publicOrder({...order, submission_hash: 'private-fingerprint'});
  for (const key of ['email','phone','customer_name','session_hash','request_key','submission_hash']) assert.equal(key in result, false);
  assert.equal(result.payment_submitted, true);
});
await check('session tokens are random and bound to a server secret', () => {
  const token = security.newSessionToken();
  assert.match(token, /^[a-f0-9]{64}$/); assert.notEqual(token, security.newSessionToken());
  assert.notEqual(security.sessionHash(token, 'one'), security.sessionHash(token, 'two'));
  assert.equal(security.sessionToken(new Request('https://example.invalid', {headers: {cookie: 'aperte_payments=forged'}})), null);
  assert.equal(security.sessionToken(new Request('https://example.invalid', {headers: {cookie: 'aperte_payments=' + token}})), token);
});
await check('origin checks reject cross-site and missing origins', () => {
  process.env.VERCEL = '1';
  for (const origin of ['', 'https://evil.invalid']) assert.throws(() => security.checkOrigin(new Request('https://example.invalid', {headers: {origin}}), 'https://example.invalid'), {code: 'ORIGIN_REJECTED'});
  security.checkOrigin(new Request('https://example.invalid', {headers: {origin: 'https://example.invalid'}}), 'https://example.invalid');
});
await check('JSON type, size and validity are bounded', async () => {
  const request = (body, type = 'application/json') => new Request('https://example.invalid', {method: 'POST', headers: {'Content-Type': type}, body});
  await assert.rejects(security.readJson(request('{}','text/plain')), {code: 'INVALID_CONTENT_TYPE'});
  await assert.rejects(security.readJson(request('x'.repeat(12001))), {code: 'BODY_TOO_LARGE'});
  await assert.rejects(security.readJson(request('broken')), {code: 'INVALID_JSON'});
  assert.deepEqual(await security.readJson(request('{"hello":true}')), {hello: true});
});
await check('webhook signature binds request, query ID and body ID; forged events fail', () => {
  const secret = 'synthetic-signature-secret', ts = '1791288000', requestId = 'test-request-id';
  const signature = createHmac('sha256', secret).update(`id:123456;request-id:${requestId};ts:${ts};`).digest('hex');
  const headers = {'x-signature': `ts=${ts},v1=${signature}`, 'x-request-id': requestId};
  const request = new Request('https://example.invalid/api/payments/webhook?data.id=123456', {headers});
  const body = {type: 'payment', data: {id: 123456}};
  assert.equal(security.verifyNotification(request, body, secret), '123456');
  assert.equal(security.verifyNotification(request, body, 'wrong'), null);
  assert.equal(security.verifyNotification(request, {...body, data: {id: 654321}}, secret), null);
  assert.equal(security.verifyNotification(new Request('https://example.invalid?data.id=654321', {headers}), body, secret), null);
  assert.equal(security.verifyNotification(new Request(request.url), body, secret), null);
});
await check('all disabled payment endpoints reject before touching network or database', async () => {
  for (const route of ['./app/api/checkout/route.js','./app/api/checkout/pay/route.js','./app/api/payments/webhook/route.js']) {
    const response = await require(route).POST(new Request('https://example.invalid', {method:'POST'}));
    assert.equal(response.status, 503); assert.equal((await response.json()).code, 'PAYMENTS_NOT_CONFIGURED');
  }
  const response = await require('./app/api/checkout/route.js').GET(new Request('https://example.invalid'));
  assert.equal((await response.json()).publicKey, null); assert.equal(response.headers.get('Set-Cookie'), null);
});
Object.assign(process.env, {PAYMENTS_ENABLED: 'true', MP_MODE: 'test', MP_PUBLIC_KEY: 'SYNTHETIC-public', MP_ACCESS_TOKEN: 'SYNTHETIC-private', MP_COLLECTOR_ID: '42', MP_WEBHOOK_SECRET: 'SYNTHETIC-secret', PAYMENTS_SESSION_SECRET: 'synthetic-session-secret-at-least-32-chars', DATABASE_URL: 'postgres://test:test@localhost/test', APP_URL: 'https://example.invalid'});
await check('enabled checkout exposes only public configuration and secure HttpOnly cookie', async () => {
  const response = await require('./app/api/checkout/route.js').GET(new Request('https://example.invalid'));
  const body = await response.text();
  assert.match(body, /SYNTHETIC-public/); assert.doesNotMatch(body, /SYNTHETIC-private|session-secret|postgres:/);
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly; SameSite=Lax; Path=\/api\/checkout/);
  assert.match(response.headers.get('Set-Cookie'), /Secure/);
});
await check('order ownership is enforced even when an attacker knows the UUID', async () => {
  const {ownedOrder} = require('./lib/payments/http.js');
  const token = security.newSessionToken(), owner = security.sessionHash(token, process.env.PAYMENTS_SESSION_SECRET);
  const original = repository.findOrder;
  repository.findOrder = async (requestedId, requestedOwner) => requestedId === id && requestedOwner === owner ? order : undefined;
  try {
    const request = token => new Request('https://example.invalid', {headers: {cookie: 'aperte_payments=' + token}});
    assert.equal(await ownedOrder(request(token), id), order);
    await assert.rejects(ownedOrder(request(security.newSessionToken()), id), {code: 'ORDER_NOT_FOUND'});
    await assert.rejects(ownedOrder(new Request('https://example.invalid'), id), {code: 'ORDER_NOT_FOUND'});
  } finally {repository.findOrder = original;}
});
await check('repeated charge submissions use one provider idempotency key', async () => {
  const {Payment} = require('mercadopago');
  const create = Payment.prototype.create, apply = repository.applyPayment;
  const keys = [];
  Payment.prototype.create = async options => {keys.push(options.requestOptions.idempotencyKey); return receipt;};
  repository.applyPayment = async () => ({...order, status: 'approved', payment_id: '123456'});
  try {
    const body = provider.paymentBody(order, input, 'https://example.invalid');
    await provider.submitPayment(order, body); await provider.submitPayment(order, body);
    assert.deepEqual(keys, [id, id]);
  } finally {Payment.prototype.create = create; repository.applyPayment = apply;}
});
console.log(`${total} payment checks passed. Offline fixtures only; no live payment or database verification.`);
