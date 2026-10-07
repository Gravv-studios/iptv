'use client';

import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, LockKeyhole, QrCode, ReceiptText, RefreshCw, ShieldCheck} from 'lucide-react';
import {BrandLogo} from '../../components/brand-logo';
import {getPlan, money, plans} from '../../lib/domain';
import {trialUrl} from '../../lib/offer';
import {customerSupportUrl} from '../../lib/sales';
import {paymentLabels, type PublicOrder} from '../../lib/payments/types';
import {PaymentInstructions} from '../../components/payment-instructions';
import '../mobile-storefront.css';
import '../public-service.css';
import './payment.css';

const MercadoPagoCheckout = dynamic(() => import('../../components/mercado-pago-checkout'), {ssr: false, loading: () => <p role="status">Carregando Mercado Pago…</p>});
type Config = {ready: boolean; publicKey: string | null; mode: 'test' | 'production'};
async function requestJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {cache: 'no-store', ...(body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})});
  const result = await response.json() as T & {error?: string};
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível concluir. Tente consultar o pedido.');
  return result;
}

export default function PublicPurchase({initialPlanId}: {initialPlanId: typeof plans[number]['id']}) {
  const [planId, setPlanId] = useState(initialPlanId);
  const [config, setConfig] = useState<Config | null>(null), [order, setOrder] = useState<PublicOrder | null>(null);
  const [customer, setCustomer] = useState({customerName: '', email: '', phone: ''});
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const requestKey = useRef(''), sending = useRef(false);
  const plan = getPlan(planId)!;
  const currentOrderId = order?.id, currentPaymentStatus = order?.status, paymentSubmitted = order?.payment_submitted;
  const refresh = useCallback(async (id: string) => {
    const data = await requestJson<{order: PublicOrder}>('/api/checkout/orders/' + encodeURIComponent(id));
    setOrder(data.order); setUncertain(false); return data.order as PublicOrder;
  }, []);
  useEffect(() => {
    requestKey.current = crypto.randomUUID();
    let active = true;
    void (async () => {
      try {
        const data = await requestJson<Config>('/api/checkout');
        if (!active) return;
        if (data.ready && data.publicKey) {
          const {initMercadoPago} = await import('@mercadopago/sdk-react');
          if (!active) return;
          initMercadoPago(data.publicKey, {locale: 'pt-BR'});
        }
        setConfig(data);
        const id = new URLSearchParams(location.search).get('pedido');
        if (id && data.ready) await refresh(id);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar o pagamento.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => {active = false;};
  }, [refresh]);
  useEffect(() => {
    if (!currentOrderId || (!paymentSubmitted && !uncertain) || ['approved','rejected','cancelled','refunded','charged_back'].includes(currentPaymentStatus ?? '')) return;
    let count = 0;
    const timer = setInterval(() => {
      if (document.hidden || sending.current) return;
      if (++count > 40) { clearInterval(timer); return; }
      void refresh(currentOrderId).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [currentOrderId, currentPaymentStatus, paymentSubmitted, uncertain, refresh]);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !config?.ready) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const data = await requestJson<{order: PublicOrder}>('/api/checkout', {...customer, planId, requestKey: requestKey.current});
      setOrder(data.order); history.replaceState(null, '', '/comprar?plano=' + data.order.plan_id + '&pedido=' + data.order.id);
    } catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível criar o pedido.');}
    finally {sending.current = false; setBusy(false);}
  }
  async function submit(data: unknown) {
    if (!order || sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await requestJson<{order: PublicOrder}>('/api/checkout/pay', {...data as object, orderId: order.id});
      setOrder(result.order);
    } catch (e) {
      setUncertain(true);
      setError(e instanceof Error ? e.message : 'Consulte o status antes de fazer outro pagamento.');
      // Keep the form closed after any ambiguous response; never retry a charge automatically.
      try {await refresh(order.id);} catch {}
      throw e;
    } finally {sending.current = false; setBusy(false);}
  }
  const amount = order?.amount_cents ?? plan.amount;
  const step = order ? order.payment_submitted || order.payment_id || uncertain ? 3 : 2 : 1;

  return <div className="ap-site ap-public">
    <header className="ap-header"><div className="ap-container ap-header-inner"><BrandLogo/><Link className="ap-account" href="/#planos"><ArrowLeft size={17}/>Ver planos</Link></div></header>
    <main className="ap-container ap-service-main">
      <section className="ap-service-copy">
        <div className="mp-steps" aria-label="Etapas da compra">{['Seu plano','Pagamento','Confirmação'].map((text,index) => <span className={step === index + 1 ? 'active' : ''} key={text}>{index + 1}. {text}</span>)}</div>
        <p className="ap-service-kicker">SEU PRÓXIMO PLAY</p>
        <h1>{order ? <>Seu pedido.<br/><span>Tudo por aqui.</span></> : <>Seu plano escolhido.<br/><span>Seu pagamento aqui.</span></>}</h1>
        <p>Pix, cartões e boleto pelo Mercado Pago, sem sair do site para falar com um vendedor.</p>
        {config?.ready && config.mode === 'test' && <div className="mp-alert">Ambiente de teste. Use somente os dados de teste do Mercado Pago. Nenhum acesso real será emitido.</div>}
        {loading && <p className="mp-loading" role="status">Preparando o checkout…</p>}
        {!loading && !config?.ready && <div className="mp-alert" role="status"><LockKeyhole size={20}/><div><strong>Pagamento online em ativação</strong><p>A conexão com o Mercado Pago está sendo preparada. Nenhuma cobrança está disponível neste momento.</p></div></div>}
        {error && <div className="mp-error" role="alert">{error}</div>}
        {!order && <><fieldset className="ap-periods" disabled={busy}><legend>Por quanto tempo você quer assistir?</legend>
          {plans.map(item => <label className={item.id === planId ? 'selected' : ''} key={item.id}>
            <input type="radio" name="periodo" value={item.id} checked={item.id === planId} onChange={() => {setPlanId(item.id); requestKey.current = crypto.randomUUID(); history.replaceState(null, '', '/comprar?plano=' + item.id);}}/>
            <span><strong>{item.period}</strong><small>{item.name.replace('Aperte Play ', '')}</small></span>
            <strong>{money(item.amount)}</strong>
          </label>)}
        </fieldset><form className="mp-customer" onSubmit={create}>
          <h2>Quem vai receber o acesso?</h2><p>Usaremos esses dados para identificar o pedido e orientar a ativação.</p>
          <fieldset disabled={!config?.ready || busy}>
            <label>Nome completo<input name="name" autoComplete="name" required minLength={3} maxLength={100} value={customer.customerName} onChange={e => {setCustomer({...customer, customerName: e.target.value}); requestKey.current = crypto.randomUUID();}} placeholder="Seu nome"/></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={200} value={customer.email} onChange={e => {setCustomer({...customer, email: e.target.value}); requestKey.current = crypto.randomUUID();}} placeholder="voce@email.com"/></label>
            <label>WhatsApp com DDD<input name="phone" type="tel" autoComplete="tel" inputMode="tel" required minLength={10} maxLength={20} value={customer.phone} onChange={e => {setCustomer({...customer, phone: e.target.value}); requestKey.current = crypto.randomUUID();}} placeholder="(00) 00000-0000"/></label>
            <button className="ap-button" type="submit" disabled={!config?.ready || busy}>{busy ? 'Preparando pedido…' : config?.ready ? 'Ir para o pagamento' : 'Pagamento em ativação'}<ArrowRight size={18}/></button>
          </fieldset>
          <p className="ap-service-fine">Seus dados identificam a compra. Os dados necessários ao pagamento são processados pelo Mercado Pago. O site não armazena número do cartão nem código de segurança.</p>
        </form></>}
        {order && <div className="mp-order-flow">
          <p className="mp-order-code">Pedido #{order.id.slice(0,8).toUpperCase()} · Guarde esta página para consultar neste navegador.</p>
          {(step === 3 || uncertain) && <div className={'mp-result ' + (order.status === 'approved' ? 'approved' : '')} role="status">
            {order.status === 'approved' ? <CheckCircle2 size={28}/> : <RefreshCw size={25}/>}
            <div><h2>{order.status === 'created' && (uncertain || order.payment_submitted) ? 'Confirmando a situação do pagamento' : paymentLabels[order.status]}</h2>
            <p>{order.fulfillment === 'review_required' ? 'A equipe precisa conferir este pedido. Fale com o atendimento.' : order.status === 'approved' ? order.mode === 'test' ? 'Teste confirmado. Nenhum acesso real foi liberado.' : 'Recebemos a confirmação do Mercado Pago. A equipe vai orientar a ativação pelo contato informado.' : ['rejected','cancelled'].includes(order.status) ? 'Este pagamento não foi concluído. Você pode iniciar outro pedido abaixo.' : 'A confirmação será atualizada aqui. Não faça um novo pagamento enquanto este pedido estiver em análise.'}</p></div>
          </div>}
          {config?.publicKey && !uncertain && !order.payment_submitted && !order.provider_order_id && order.status === 'created' && <div className="mp-brick"><MercadoPagoCheckout amount={amount / 100} email={customer.email || undefined} busy={busy} onSubmit={submit} onError={() => setError('Não foi possível carregar o ambiente do Mercado Pago. Atualize o status ou fale com o atendimento.')}/></div>}
          {['pending','in_process','created'].includes(order.status) && <PaymentInstructions instructions={order.payment_instructions}/>}
          <button className="mp-refresh" disabled={busy} onClick={async () => {setBusy(true); setError(''); try {await refresh(order.id);} catch(e) {setError(e instanceof Error ? e.message : 'Tente novamente.');} finally {setBusy(false);}}}><RefreshCw size={16}/>{busy ? 'Consultando…' : 'Atualizar status do pedido'}</button>
          {(['rejected','cancelled'].includes(order.status) || (!order.payment_submitted && !order.payment_id && !uncertain && !busy)) && <a className="ap-trial-alternative" href={'/comprar?plano=' + order.plan_id}>Iniciar outro pedido</a>}
          <a className="ap-trial-alternative" href={customerSupportUrl} target="_blank" rel="noopener noreferrer">Preciso de ajuda com este pedido</a>
        </div>}
      </section>
      <aside className="ap-order-card" aria-label="Resumo do plano escolhido">
        <ShieldCheck size={28}/>
        <h2>{order?.plan_name ?? plan.name}</h2><p>{order?.period ?? plan.period} de acesso</p>
        <div className="ap-order-total"><span>Valor total pelo período</span><strong>{money(amount)}</strong></div>
        <div className="mp-methods"><span><QrCode size={22}/><strong>Pix</strong><small>QR Code e copia e cola</small></span><span><CreditCard size={22}/><strong>Cartões</strong><small>Meios disponíveis na conta</small></span><span><ReceiptText size={22}/><strong>Boleto</strong><small>Após compensação</small></span></div>
        <ul><li><Check size={18}/>Pagamento processado pelo Mercado Pago</li><li><Check size={18}/>Confirmação acompanhada no site</li><li><Check size={18}/>Sem renovação automática</li></ul>
        <p className="ap-service-fine">A ativação é feita pela equipe após a confirmação do pagamento, pelo contato informado no pedido.</p>
        <a className="ap-trial-alternative" href={trialUrl} target="_blank" rel="noopener noreferrer">Prefiro testar 5 horas grátis primeiro</a>
      </aside>
    </main>
    <footer className="ap-service-footer ap-container">Aperte Play · Seu momento começa com um play.</footer>
  </div>;
}
