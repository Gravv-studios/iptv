'use client';

import {useState} from 'react';
import {ArrowLeft, ArrowUpRight, Check, MessageCircle, Play} from 'lucide-react';
import {BrandLogo} from '../../components/brand-logo';
import {getPlan, money, plans} from '../../lib/domain';
import {trialUrl} from '../../lib/offer';
import {purchaseUrl} from '../../lib/sales';
import '../mobile-storefront.css';
import '../public-service.css';

export default function PublicPurchase({initialPlanId}: {initialPlanId: typeof plans[number]['id']}) {
  const [planId, setPlanId] = useState(initialPlanId);
  const plan = getPlan(planId)!;

  return <div className="ap-site ap-public">
    <header className="ap-header"><div className="ap-container ap-header-inner"><BrandLogo/><a className="ap-account" href="/#planos"><ArrowLeft size={17}/>Ver planos</a></div></header>
    <main className="ap-container ap-service-main">
      <section className="ap-service-copy">
        <p className="ap-service-kicker">SEU PRÓXIMO PLAY</p>
        <h1>Escolha seu plano.<br/><span>A gente ajuda no resto.</span></h1>
        <p>Confira o período e continue pelo WhatsApp. A equipe confirma seu aparelho e orienta o pagamento e a ativação.</p>
        <fieldset className="ap-periods"><legend>Por quanto tempo você quer assistir?</legend>
          {plans.map(item => <label className={item.id === planId ? 'selected' : ''} key={item.id}>
            <input type="radio" name="periodo" value={item.id} checked={item.id === planId} onChange={() => {setPlanId(item.id); history.replaceState(null, '', '/comprar?plano=' + item.id);}}/>
            <span><strong>{item.period}</strong><small>{item.name.replace('Aperte Play ', '')}</small></span>
            <strong>{money(item.amount)}</strong>
          </label>)}
        </fieldset>
        <div className="ap-service-note"><MessageCircle size={20}/><p>Você conversa com a equipe antes de pagar. Nenhuma cobrança é feita nesta página.</p></div>
      </section>
      <aside className="ap-order-card" aria-label="Resumo do plano escolhido">
        <Play size={28} fill="currentColor"/>
        <h2>{plan.name}</h2><p>{plan.period} de acesso</p>
        <div className="ap-order-total"><span>Valor total pelo período</span><strong>{money(plan.amount)}</strong></div>
        <ul><li><Check size={18}/>Confirme o catálogo e seu aparelho</li><li><Check size={18}/>Receba orientações para o pagamento</li><li><Check size={18}/>Combine a ativação com a equipe</li></ul>
        <a className="ap-button" href={purchaseUrl(planId)} target="_blank" rel="noopener noreferrer">Contratar pelo WhatsApp<ArrowUpRight size={19}/></a>
        <p className="ap-service-fine">O WhatsApp abre com seu plano e valor preenchidos. Envie a mensagem para continuar.</p>
        <a className="ap-trial-alternative" href={trialUrl} target="_blank" rel="noopener noreferrer">Prefiro testar 6 horas grátis primeiro</a>
      </aside>
    </main>
    <footer className="ap-service-footer ap-container">Aperte Play · Seu momento começa com um play.</footer>
  </div>;
}
