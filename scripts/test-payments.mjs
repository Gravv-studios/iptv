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
  const target = path.join(output, relative.replace(/\.tsx?$/, '.js'));
  await mkdir(path.dirname(target), {recursive: true});
  await writeFile(target, ts.transpileModule(await readFile(path.join(root, relative), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText);
}
for (const dir of ['lib/payments','lib/whatsapp']) for (const file of await readdir(path.join(root, dir))) if (file.endsWith('.ts')) await compile(dir + '/' + file);
for (const file of ['lib/domain.ts','lib/offer.ts','app/api/checkout/route.ts','app/api/checkout/pay/route.ts','app/api/payments/webhook/route.ts','app/api/checkout/orders/[id]/route.ts']) await compile(file);
await compile('components/payment-instructions.tsx');
const require = createRequire(path.join(output, 'tests.cjs'));
const security = require('./lib/payments/security.js');
const config = require('./lib/payments/config.js');
const validation = require('./lib/payments/validation.js');
const provider = require('./lib/payments/mercado-pago.js');
const {publicOrder} = require('./lib/payments/types.js');
const repository = require('./lib/payments/repository.js');
const http = require('./lib/payments/http.js');
const {Order, User, MPBadRequestError, MPPaymentError} = require('mercadopago');

globalThis.fetch = async () => { throw new Error('Unexpected outbound request in offline test'); };
for (const key of ['PAYMENTS_ENABLED','MP_MODE','MP_PUBLIC_KEY','MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','PAYMENTS_SESSION_SECRET','MP_COLLECTOR_ID','DATABASE_URL','APP_URL','VERCEL']) delete process.env[key];
let total = 0;
async function check(name, fn) { await fn(); total++; console.log('OK ' + name); }
async function patch(target, overrides, run) {
  const original = Object.fromEntries(Object.keys(overrides).map(key => [key, target[key]]));
  Object.assign(target, overrides);
  try { await run(); } finally {Object.assign(target, original);}
}
const id = randomUUID(), providerId = 'ORD01JS2V6CM8KJ0EC4H502TGK1WP', paymentId = 'PAY01JS2V6CM8KJ0EC4H504R7YE34';
const order = {id, request_key: randomUUID(), session_hash: 'private-hash', plan_id: 'mensal', plan_name: 'Aperte Play Mensal', period: '1 mês', amount_cents: 2500, customer_name: 'Cliente de Teste', email: 'comprador@testuser.com', phone: '31999990000', mode: 'test', status: 'created', payment_id: null, provider_order_id: null, payment_instructions: null, submission_hash: 'private-fingerprint', provider_updated_at: null, fulfillment: 'awaiting_payment', created_at: '2026-10-06T12:00:00.000Z', updated_at: '2026-10-06T12:00:00.000Z'};
const raw = {orderId: id, selectedPaymentMethod: 'bank_transfer', formData: {payment_method_id: 'pix', transaction_amount: 0.01, payer: {email: 'different@example.invalid', identification: {type: 'CPF', number: '00000000000'}}, metadata: {app: 'forged'}, status: 'approved'}};
const input = validation.submissionInput.parse(raw);
const receipt = {id: providerId, type: 'online', external_reference: id, total_amount: '25.00', total_paid_amount: '25.00', country_code: 'BRA', user_id: '42', status: 'processed', status_detail: 'accredited', last_updated_date: '2026-10-06T12:01:00.000Z', transactions: {payments: [{id: paymentId, amount: '25.00', paid_amount: '25.00', status: 'processed', status_detail: 'accredited', payment_method: {id: 'visa', type: 'credit_card'}}]}};
const account = {id: '42', mode: 'test'};
const verify = data => validation.verifiedProviderOrder(order, data, account);
const changePayment = change => ({...receipt, transactions: {payments: [{...receipt.transactions.payments[0], ...change}]}});
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ9sAAAAASUVORK5CYII=';

await check('incomplete or disabled configuration cannot enable charges', () => {
  assert.equal(config.paymentConfig().ready, false);
  assert.throws(config.requirePaymentConfig, {code: 'PAYMENTS_NOT_CONFIGURED'});
  process.env.PAYMENTS_ENABLED = 'true'; assert.equal(config.paymentConfig().ready, false); process.env.PAYMENTS_ENABLED = 'false';
});
await check('browser cannot set a price, retired plan or malformed buyer data', () => {
  const data = {requestKey: randomUUID(), planId: 'mensal', customerName: ' Cliente Teste ', email: 'TESTE@example.invalid', phone: '(31) 99999-0000'};
  assert.equal(validation.orderInput.parse(data).email, 'teste@example.invalid');
  assert.equal(validation.orderInput.parse(data).phone, '31999990000');
  for (const extra of [{amount: 1},{planId: 'trimestral'},{email: 'bad'},{phone: '1'}]) assert.equal(validation.orderInput.safeParse({...data,...extra}).success, false);
});
await check('Orders payload has exact server price, immutable reference and relative Pix expiry', () => {
  const body = provider.paymentBody(order, input);
  assert.equal(body.total_amount, '25.00'); assert.equal(body.transactions.payments[0].amount, '25.00');
  assert.equal(body.payer.email, order.email); assert.equal(body.external_reference, id);
  assert.equal(body.transactions.payments[0].expiration_time, 'PT30M');
  assert.equal(body.processing_mode, 'automatic'); assert.equal(body.transaction_amount, undefined); assert.equal(body.metadata, undefined); assert.equal(body.notification_url, undefined);
  assert.deepEqual(provider.paymentBody({...order, created_at: '2020-01-01T00:00:00Z'}, input), body, 'A cart age does not shorten provider expiry or change the fingerprint.');
  assert.equal(body.status, undefined);
});
await check('cards require a token, matching type, one installment and no wallet', () => {
  assert.throws(() => validation.validateMethod({...input, selectedPaymentMethod: 'creditCard'}));
  assert.throws(() => validation.validateMethod({...input, formData: {...input.formData, payment_method_id: 'account_money'}}));
  assert.equal(validation.submissionInput.safeParse({...raw, formData: {...raw.formData, installments: 2}}).success, false);
  const card = validation.submissionInput.parse({...raw, selectedPaymentMethod: 'debitCard', paymentTypeId: 'debit_card', formData: {...raw.formData, payment_method_id: 'visa', token: 'test-token-12345', installments: 1}});
  assert.equal(provider.paymentBody(order, card).transactions.payments[0].payment_method.type, 'debit_card');
  assert.equal(provider.paymentBody(order, card).transactions.payments[0].payment_method.installments, 1);
  assert.throws(() => provider.paymentBody(order, {...card, paymentTypeId: 'credit_card'}));
});
await check('boleto normalizes method/address and requires address with a three-day relative term', () => {
  const boleto = {...input, selectedPaymentMethod: 'ticket', formData: {...input.formData, payment_method_id: 'bolbradesco'}};
  assert.throws(() => validation.validateMethod(boleto));
  boleto.formData.payer = {...input.formData.payer, address: {zip_code: '00000000', street_name: 'Rua de Teste', street_number: '1', neighborhood: 'Teste', city: 'Teste', federal_unit: 'MG'}};
  const body = provider.paymentBody(order, boleto);
  assert.equal(body.transactions.payments[0].expiration_time, 'P3D'); assert.equal(body.transactions.payments[0].payment_method.id, 'boleto'); assert.equal(body.payer.address.state, 'MG'); assert.equal(body.payer.address.federal_unit, undefined);
});
await check('CPF and CNPJ lengths cannot be swapped', () => {
  assert.equal(validation.submissionInput.safeParse({...raw, formData: {...raw.formData, payer: {identification: {type: 'CNPJ', number: '00000000000'}}}}).success, false);
});
await check('authenticated seller and environment are checked without inventing Orders live_mode', () => {
  const profile = {id: 42, site_id: 'MLB', tags: ['test_user']};
  assert.deepEqual(provider.verifiedAccount(profile, {collectorId: '42', mode: 'test'}), account);
  for (const c of [{collectorId: '43', mode: 'test'}, {collectorId: '42', mode: 'production'}]) assert.throws(() => provider.verifiedAccount(profile, c), {code: 'PAYMENT_ACCOUNT_MISMATCH'});
  assert.throws(() => provider.verifiedAccount({...profile, tags: undefined}, {collectorId: '42', mode: 'production'}));
  assert.throws(() => provider.verifiedAccount({...profile, site_id: 'MLA'}, {collectorId: '42', mode: 'test'}));
});
await check('only a credited, completely paid order and transaction becomes approved', () => {
  const result = verify(receipt); assert.equal(result.status, 'approved'); assert.equal(result.id, paymentId); assert.equal(result.providerId, providerId);
});
for (const [name, change] of Object.entries({amount:{total_amount:'1.00'},currency:{currency:'USD'},country:{country_code:'ARG'},receiver:{user_id:'43'},reference:{external_reference:randomUUID()},status:{status:'unknown'},date:{last_updated_date:'invalid'},id:{id:'123'},paid:{total_paid_amount:'0.00'},noPayment:{transactions:{}},manyPayments:{transactions:{payments:[receipt.transactions.payments[0],receipt.transactions.payments[0]]}}})) {
  await check('provider mismatch rejected: ' + name, () => assert.throws(() => verify({...receipt,...change}), {code:'PAYMENT_MISMATCH'}));
}
for (const [name, change] of Object.entries({unpaid:{paid_amount:'0.00'},nonCredited:{status:'action_required',status_detail:'waiting_transfer'},underpaid:{amount:'0.01'},missingPaymentId:{id:undefined},invalidPrecision:{amount:'25.001'}})) {
  await check('transaction mismatch rejected: ' + name, () => assert.throws(() => verify(changePayment(change)), {code:'PAYMENT_MISMATCH'}));
}
await check('wrong environment, unsolicited order and replacement provider IDs rejected', () => {
  assert.throws(() => validation.verifiedProviderOrder(order, receipt, {...account, mode:'production'}));
  for (const change of [{submission_hash:null},{payment_id:'PAYOTHER'},{provider_order_id:'ORDOTHER'}]) assert.throws(() => validation.verifiedProviderOrder({...order,...change}, receipt, account));
});
await check('asynchronous order without a payment remains in process', () => {
  const result = verify({...receipt, status:'processing', status_detail:'in_process', transactions:{}});
  assert.equal(result.status, 'in_process'); assert.equal(result.id, null); assert.equal(result.instructions, null);
});
await check('refund and chargeback always require review rather than activation', () => {
  assert.equal(verify(changePayment({refunded_amount:'1.00'})).status,'in_mediation');
  assert.equal(verify({...receipt,status:'refunded'}).status,'refunded');
  assert.equal(verify({...receipt,transactions:{...receipt.transactions,chargebacks:[{id:'case'}]}}).status,'charged_back');
});
await check('terminal nonpayment and reserved funds are mapped conservatively', () => {
  for (const [state,expected] of [['failed','rejected'],['canceled','cancelled'],['expired','cancelled']]) {
    assert.equal(verify({...changePayment({status:state}),status:state}).status, expected);
  }
  assert.equal(verify({...changePayment({status:'action_required',status_detail:'waiting_capture'}),status:'action_required'}).status, 'authorized');
});
function pending(method) { return {...receipt,status:'action_required',status_detail:'waiting_transfer',transactions:{payments:[{...receipt.transactions.payments[0],status:'action_required',status_detail:'waiting_transfer',payment_method:method}]}}; }
await check('Pix instructions expose only bounded codes and PNGs from a verified order', () => {
  const result = verify(pending({id:'pix',type:'bank_transfer',qr_code:'000201PIX',qr_code_base64:png,ticket_url:'https://www.mercadopago.com.br/payments/1/ticket'}));
  assert.deepEqual(result.instructions,{kind:'pix',ticketUrl:'https://www.mercadopago.com.br/payments/1/ticket',qrCode:'000201PIX',qrCodeBase64:png});
  for (const bad of ['data:image/svg+xml;base64,xxx','PHN2Zz48L3N2Zz4=','A'.repeat(200004)]) assert.equal(verify(pending({id:'pix',qr_code_base64:bad})).instructions.qrCodeBase64,undefined);
  assert.equal(verify(pending({id:'pix',qr_code:'x'.repeat(5000)})).instructions.qrCode, undefined);
});
await check('unsafe ticket redirects are never returned', () => {
  for (const url of ['javascript:alert(1)','http://mercadopago.com.br/x','https://mercadopago.com.br.evil.test/x','https://user:secret@mercadopago.com.br/x','https://evil.test/x']) assert.equal(validation.safeTicketUrl(url), undefined);
});
await check('boleto exposes its numeric line rather than arbitrary provider text', () => {
  const code = '1234567890'.repeat(5);
  assert.equal(verify(pending({id:'boleto',digitable_line:code})).instructions.barcode,code);
  assert.equal(verify(pending({id:'boleto',digitable_line:'<script>alert(1)</script>'})).instructions.barcode,undefined);
});
await check('stale or regressive notifications cannot undo paid/refunded state', () => {
  const approved = verify(receipt);
  const prior = {...order,status:'approved',payment_id:paymentId,provider_order_id:providerId,provider_updated_at:receipt.last_updated_date};
  assert.equal(repository.canApplyPayment(prior,approved),true);
  assert.equal(repository.canApplyPayment(prior,{...approved,status:'pending'}),false);
  assert.equal(repository.canApplyPayment(prior,{...approved,updatedAt:'2026-10-06T12:00:59Z'}),false);
  assert.equal(repository.canApplyPayment({...prior,status:'refunded'},approved),false);
  assert.equal(repository.canApplyPayment(prior,{...approved,providerId:'ORDOTHER'}),false);
});
await check('public order never reveals identity, submission payload or ownership hash', () => {
  const result = publicOrder(order);
  for (const key of ['email','phone','customer_name','session_hash','request_key','submission_hash','payer','token']) assert.equal(key in result,false);
  assert.equal(result.payment_submitted,true);
  assert.equal(publicOrder({...order,status:'approved',payment_instructions:{kind:'pix',qrCode:'old'}}).payment_instructions,null);
  assert.deepEqual(publicOrder({...order,status:'pending',payment_instructions:JSON.stringify({kind:'pix',qrCode:'000201PIX'})}).payment_instructions,{kind:'pix',qrCode:'000201PIX'});
  assert.equal(publicOrder({...order,status:'pending',payment_instructions:'not json'}).payment_instructions,null);
});
await check('session tokens are random and accepted only in the HttpOnly cookie format', () => {
  const token = security.newSessionToken(); assert.match(token,/^[a-f0-9]{64}$/); assert.notEqual(token,security.newSessionToken());
  assert.equal(security.sessionToken(new Request('https://example.invalid',{headers:{cookie:'aperte_payments='+token}})),token);
  assert.equal(security.sessionToken(new Request('https://example.invalid',{headers:{cookie:'aperte_payments=bad'}})),null);
});
await check('cross-origin requests are refused and oversized payloads bounded', async () => {
  assert.throws(() => security.checkOrigin(new Request('https://example.invalid',{headers:{origin:'https://evil.invalid'}}),'https://example.invalid'),{code:'ORIGIN_REJECTED'});
  await assert.rejects(security.readJson(new Request('https://example.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify('a'.repeat(13000))})),{code:'BODY_TOO_LARGE'});
});
await check('Orders signature lowercases alphanumeric data.id and binds the body/request ID', () => {
  const secret='synthetic',ts='1791288000',requestId='request-test';
  const signature=createHmac('sha256',secret).update(`id:${providerId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  const headers={'x-request-id':requestId,'x-signature':`ts=${ts},v1=${signature}`};
  const request=new Request('https://example.invalid/api/payments/webhook?data.id='+providerId,{headers});
  const body={type:'order',data:{id:providerId}};
  assert.equal(security.verifyNotification(request,body,secret),providerId);
  assert.equal(security.verifyNotification(request,{...body,type:'payment'},secret),null);
  assert.equal(security.verifyNotification(request,{...body,data:{id:'ORDOTHER'}},secret),null);
  assert.equal(security.verifyNotification(request,body,'wrong'),null);
  assert.equal(security.verifyNotification(new Request(request.url),body,secret),null);
});
await check('disabled endpoints refuse before network/database access', async () => {
  for (const route of ['./app/api/checkout/route.js','./app/api/checkout/pay/route.js','./app/api/payments/webhook/route.js']) {
    const response=await require(route).POST(new Request('https://example.invalid',{method:'POST'}));
    assert.equal(response.status,503); assert.equal((await response.json()).code,'PAYMENTS_NOT_CONFIGURED');
  }
});
Object.assign(process.env,{PAYMENTS_ENABLED:'true',MP_MODE:'test',MP_PUBLIC_KEY:'SYNTHETIC-public',MP_ACCESS_TOKEN:'SYNTHETIC-private',MP_COLLECTOR_ID:'42',MP_WEBHOOK_SECRET:'SYNTHETIC-secret',PAYMENTS_SESSION_SECRET:'synthetic-session-secret-at-least-32-chars',DATABASE_URL:'postgres://test:test@localhost/test',APP_URL:'https://example.invalid'});
await check('checkout configuration exposes only public fields and a secure HttpOnly cookie', async () => {
  const response=await require('./app/api/checkout/route.js').GET(new Request('https://example.invalid'));
  const body=await response.text(); assert.match(body,/SYNTHETIC-public/); assert.doesNotMatch(body,/SYNTHETIC-private|session-secret|postgres:/);
  assert.match(response.headers.get('Set-Cookie'),/HttpOnly; SameSite=Lax; Path=\/api\/checkout/); assert.match(response.headers.get('Set-Cookie'),/Secure/);
});
await check('knowing an order UUID does not grant another session access', async () => {
  const token=security.newSessionToken(),owner=security.sessionHash(token,process.env.PAYMENTS_SESSION_SECRET);
  await patch(repository,{findOrder:async (requestedId,requestedOwner)=>requestedId===id&&requestedOwner===owner?order:undefined},async()=>{
    const request=t=>new Request('https://example.invalid',{headers:{cookie:'aperte_payments='+t}});
    assert.equal(await http.ownedOrder(request(token),id),order);
    await assert.rejects(http.ownedOrder(request(security.newSessionToken()),id),{code:'ORDER_NOT_FOUND'});
  });
});
await check('technical validation errors differ from ambiguous processing/timeouts', () => {
  assert.equal(provider.isDefinitiveValidationError(new MPBadRequestError({status:400,error:'property_value'})),true);
  assert.equal(provider.isDefinitiveValidationError(new MPBadRequestError({status:400,error:'bad_request',cause:[{code:'property_value'},{code:'idempotency_validation_failed'}]})),false);
  for (const error of [new Error('timeout'),new MPPaymentError({status:402,error:'property_value'}),new MPBadRequestError({status:400,error:'unknown_error'})]) assert.equal(provider.isDefinitiveValidationError(error),false);
});
await patch(User.prototype,{get:async()=>({id:42,site_id:'MLB',tags:['test_user']})},async()=>{
  await check('create uses immutable idempotency and GETs the authoritative Orders record',async()=>{
    const calls=[];
    await patch(Order.prototype,{get:async({id:found})=>{assert.equal(found,providerId);return receipt;}},async()=>patch(globalThis,{fetch:async(url,options)=>{assert.equal(url,'https://api.mercadopago.com/v1/orders');calls.push(options);return Response.json({id:providerId},{status:201});}},async()=>{
      await patch(repository,{applyPayment:async(_order,verified)=>({...order,status:verified.status,provider_order_id:verified.providerId,payment_id:verified.id})},async()=>{
        assert.equal((await provider.submitPayment(order,provider.paymentBody(order,input))).status,'approved');
        assert.equal(calls.length,1);assert.equal(calls[0].headers['X-Idempotency-Key'],id);assert.equal(calls[0].redirect,'error');
      });
    }));
  });
  await check('definitive pre-creation 400 marks rejected; timeout never does',async()=>{
    let rejected=0;
    await patch(repository,{rejectInvalidSubmission:async()=>{rejected++;return {...order,status:'rejected'};}},async()=>{
      await patch(globalThis,{fetch:async()=>Response.json({errors:[{code:'invalid_email_for_sandbox',message:'DO NOT EXPOSE BUYER DATA'}]},{status:400})},async()=>assert.equal((await provider.submitPayment(order,provider.paymentBody(order,input))).status,'rejected'));
      await patch(globalThis,{fetch:async()=>{throw new Error('timeout');}},async()=>assert.rejects(provider.submitPayment(order,provider.paymentBody(order,input)),/timeout/));
      assert.equal(rejected,1);
    });
  });
  await check('402 with an existing order id is reconciled, not treated as no charge',async()=>{
    await patch(globalThis,{fetch:async()=>Response.json({id:providerId,status:'failed',errors:[{code:'processing_error'}]},{status:402})},async()=>{
      await patch(Order.prototype,{get:async()=>({...changePayment({status:'failed'}),status:'failed'})},async()=>patch(repository,{applyPayment:async(_order,verified)=>({...order,status:verified.status})},async()=>assert.equal((await provider.submitPayment(order,provider.paymentBody(order,input))).status,'rejected')));
    });
  });
  await check('ambiguous recovery searches Orders read-only without recreating a charge',async()=>{
    await patch(Order.prototype,{search:async options=>{assert.equal(options.options.external_reference,id);assert.ok(options.options.begin_date);return {data:[{id:providerId}],paging:{total:'1'}};},get:async()=>receipt,create:async()=>{throw new Error('Must not create during recovery');}},async()=>{
      await patch(repository,{applyPayment:async(_order,verified)=>({...order,status:verified.status})},async()=>assert.equal((await provider.reconcileOrder(order)).status,'approved'));
    });
  });
  await check('an empty search keeps uncertainty and multiple matches stop for review',async()=>{
    await patch(Order.prototype,{search:async()=>({data:[]})},async()=>assert.equal(await provider.reconcileOrder(order),order));
    await patch(Order.prototype,{search:async()=>({data:[{id:providerId},{id:providerId}],paging:{total:'2'}})},async()=>assert.rejects(provider.reconcileOrder(order),{code:'PAYMENT_REVIEW_REQUIRED'}));
  });
});
await check('repeated HTTP submissions reconcile instead of sending any new provider POST',async()=>{
  let submits=0,reconciles=0;
  await patch(http,{ownedOrder:async()=>order},async()=>patch(provider,{submitPayment:async()=>{submits++;return order;},reconcileOrder:async()=>{reconciles++;return order;}},async()=>{
    const response=await require('./app/api/checkout/pay/route.js').POST(new Request('https://example.invalid/api/checkout/pay',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify(raw)}));
    assert.equal(response.status,200);assert.equal(submits,0);assert.equal(reconciles,1);
  }));
});
await check('signed webhook ignores claimed approval and fetches authoritative order',async()=>{
  const requestId='webhook-test',ts='1791288000';
  const signature=createHmac('sha256',process.env.MP_WEBHOOK_SECRET).update(`id:${providerId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  const request=()=>new Request('https://example.invalid/api/payments/webhook?data.id='+providerId,{method:'POST',headers:{'content-type':'application/json','x-request-id':requestId,'x-signature':`ts=${ts},v1=${signature}`},body:JSON.stringify({type:'order',data:{id:providerId},status:'processed',status_detail:'accredited',total_paid_amount:'25.00'})});
  let applied;
  await patch(provider,{getProviderOrder:async()=>pending({id:'pix',qr_code:'000201PIX'})},async()=>patch(repository,{findOrder:async requestedId=>requestedId===id?order:undefined,applyPayment:async(_order,result)=>{applied=result;return order;}},async()=>{
    const response=await require('./app/api/payments/webhook/route.js').POST(request());
    assert.equal(response.status,200);assert.equal(applied.status,'pending');
  }));
});
await check('forged webhook stops before any provider lookup',async()=>{
  let reads=0;
  await patch(provider,{getProviderOrder:async()=>{reads++;return receipt;}},async()=>{
    const response=await require('./app/api/payments/webhook/route.js').POST(new Request('https://example.invalid/api/payments/webhook?data.id='+providerId,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'order',data:{id:providerId}})}));
    assert.equal(response.status,401);assert.equal(reads,0);
  });
});
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {PaymentInstructions} = require('./components/payment-instructions.js');
for (const kind of ['pix','boleto']) await check(`expired ${kind} hides payment actions and asks for reconciliation`,async()=>{
  const html=renderToStaticMarkup(createElement(PaymentInstructions,{instructions:{kind,expiresAt:'2000-01-01T00:00:00Z',qrCode:'EXPIRED-PIX-CODE',barcode:'EXPIRED-BOLETO-CODE',ticketUrl:'https://www.mercadopago.com.br/payments/example'}}));
  assert.match(html,/Prazo d[oa].*encerrado/);
  assert.match(html,/Atualize o status/);
  assert.doesNotMatch(html,/EXPIRED-|<button|<a /);
});
await check('valid Pix offers instructions rather than claiming a payment receipt',async()=>{
  const html=renderToStaticMarkup(createElement(PaymentInstructions,{instructions:{kind:'pix',expiresAt:'2999-01-01T00:00:00Z',qrCode:'TEST-PIX-CODE',ticketUrl:'https://www.mercadopago.com.br/payments/example'}}));
  assert.match(html,/Seu Pix está pronto/);
  assert.match(html,/Copiar código Pix/);
  assert.match(html,/Abrir pagamento Pix/);
  assert.doesNotMatch(html,/comprovante/);
});
console.log(`${total} payment checks passed. Offline fixtures only; no live payment or database verification.`);
