import assert from 'node:assert/strict';

// Read-only checks, plus rejected demo/payment requests. Never creates an order.
const base = process.argv[2] ?? 'http://127.0.0.1:5180';
const configuration = await fetch(`${base}/api/checkout`);
const checkout = await configuration.json();
assert.equal(checkout.ready, false, 'This test only runs against the not-yet-activated checkout.');
assert.equal(checkout.publicKey, null);
const home = await fetch(base);
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /Seu próximo/);
assert.match(html, /Atendimento pelo WhatsApp/);
assert.doesNotMatch(html, /Pagamento em demonstração/);
for (const id of ['mensal', 'semestral', 'anual']) {
  const page = await fetch(`${base}/comprar?plano=${id}`);
  assert.equal(page.status, 200);
  const body = await page.text();
  assert.match(body, /Seu pagamento aqui/);
  assert.match(body, /Mercado Pago/);
  assert.match(body, /Pagamento em ativação/);
  assert.doesNotMatch(body, /Contratar pelo WhatsApp/);
  const plan = {mensal: ['Mensal', '25,00', '1 mês'], semestral: ['Semestral', '100,00', '6 meses'], anual: ['Anual', '170,00', '12 meses']}[id];
  for (const value of plan) assert.ok(body.includes(value), `Checkout contains ${value}.`);
  assert.match(body, /5533984622431/, 'Trial keeps the approved recipient.');
}
const invalid = await fetch(`${base}/comprar?plano=inexistente`);
assert.match(await invalid.text(), /Esse plano não foi encontrado/);
const account = await fetch(`${base}/area-do-cliente`);
assert.equal(account.status, 200);
const accountHtml = await account.text();
assert.match(accountHtml, /Falar com o atendimento/);
assert.doesNotMatch(accountHtml, /aperteplay_demo|DEMO-sem-acesso/);
const forgedHeaders = {'oai-authenticated-user-id': 'vercel-test', 'oai-authenticated-user-email': 'test@example.invalid'};
const preview = await fetch(`${base}/api/demo`, {headers: forgedHeaders});
assert.equal(preview.status, 200);
const data = await preview.json();
assert.equal(data.authenticated, false, 'Public identity headers cannot authenticate anyone.');
assert.equal(data.account.user_id, 'preview');
const write = await fetch(`${base}/api/demo`, {method:'POST', headers:{...forgedHeaders, 'Content-Type':'application/json', Origin:new URL(base).origin}, body:JSON.stringify({action:'create', planId:'mensal', method:'pix', requestKey:'rejected-test-request'})});
assert.equal(write.status, 401, 'A public request cannot write into the local demo database.');
const payment = await fetch(`${base}/api/checkout`, {method:'POST'});
assert.equal(payment.status, 503);
assert.equal((await payment.json()).code, 'PAYMENTS_NOT_CONFIGURED');
for (const endpoint of ['/api/checkout/pay','/api/payments/webhook']) {
  assert.equal((await fetch(base + endpoint, {method:'POST'})).status, 503);
}
assert.equal((await fetch(`${base}/api/checkout/orders/00000000-0000-4000-8000-000000000000`)).status, 503);
for (const route of ['/signin-with-chatgpt', '/signout-with-chatgpt']) {
  const response = await fetch(base + route, {redirect:'manual'});
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location'), base).pathname, '/area-do-cliente');
}
assert.equal((await fetch(`${base}/images/aperte-play-logo.svg`)).status, 200);
assert.equal((await fetch(`${base}/pagina-inexistente`)).status, 404);
console.log('Vercel checks passed: storefront, three checkout plans, Mercado Pago activation state, customer support, rejected forged identity, disabled payment routes, legacy links, logo and 404. No orders or charges created.');
