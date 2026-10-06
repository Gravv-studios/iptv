'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Baby, Check, ChevronDown, CircleHelp, Clapperboard, Film, Headphones, Laptop, LayoutGrid, MessageCircle, Newspaper, Play, RadioTower, ShieldCheck, Smartphone, Tablet, Trophy, Tv, UserRound} from 'lucide-react';
import {plans, money} from '../lib/domain';
import {trialHours, trialUrlForDevice, whatsappDisplay, type TrialDevice} from '../lib/offer';
import {BrandLogo} from '../components/brand-logo';
import {isVercelHosted} from '../lib/hosting';
import './mobile-storefront.css';

const devices: {id: TrialDevice; label: string; Icon: typeof Tv; guidance: string}[] = [
  {id: 'tv', label: 'Smart TV', Icon: Tv, guidance: 'A equipe confirma seu modelo de TV e ajuda na configuração.'},
  {id: 'mobile', label: 'Celular', Icon: Smartphone, guidance: 'Informe se usa Android ou iPhone. Também pode ser um tablet.'},
  {id: 'computer', label: 'Computador', Icon: Laptop, guidance: 'A equipe confirma as opções para o seu computador.'},
];

// Illustrative categories only: the catalog itself is confirmed by the team before purchase.
const genres = [
  {id: 'live', label: 'Canais ao vivo', Icon: RadioTower},
  {id: 'movies', label: 'Filmes', Icon: Film},
  {id: 'series', label: 'Séries', Icon: Clapperboard},
  {id: 'sports', label: 'Esportes', Icon: Trophy},
  {id: 'kids', label: 'Infantil', Icon: Baby},
  {id: 'news', label: 'Notícias', Icon: Newspaper},
];

const screens = [
  {label: 'Smart TV', Icon: Tv},
  {label: 'Celular', Icon: Smartphone},
  {label: 'Tablet', Icon: Tablet},
  {label: 'Computador', Icon: Laptop},
];

const planMonths: Record<string, number> = {mensal: 1, semestral: 6, anual: 12};

const faqs = [
  {q: 'Como recebo minhas 6 horas grátis?', a: 'Escolha seu aparelho, se quiser, e toque no botão de teste. O WhatsApp abre com a mensagem pronta. Envie para a equipe, que vai orientar a configuração e confirmar a ativação do seu acesso.'},
  {q: 'Preciso cadastrar um cartão?', a: 'Não. O teste é gratuito, sem cartão e sem cobrança automática. Você só paga se decidir contratar um plano depois.'},
  {q: 'Vai funcionar no meu aparelho?', a: 'Conte à equipe qual é o modelo da sua TV, celular, tablet ou computador. Ela confirma a compatibilidade e o aplicativo indicado antes de ativar seu teste. Escolher um aparelho aqui não garante compatibilidade.'},
  {q: 'O que acontece quando o teste acaba?', a: 'Você decide se quer continuar. Escolha o mensal por R$ 25, o semestral por R$ 100 ou o anual por R$ 170. O teste não se transforma em assinatura automaticamente.'},
  {q: 'Quais conteúdos estão disponíveis?', a: 'Peça o catálogo à equipe antes de contratar. A lista de conteúdos depende do fornecedor e deve ser confirmada com o atendimento. As imagens do site são ilustrativas.'},
  {q: 'Como faço para comprar ou renovar?', a: isVercelHosted ? 'Escolha um plano e abra o checkout no site. O pagamento com Pix, cartões e boleto será processado pelo Mercado Pago assim que a conta recebedora for ativada. A página informa quando estiver disponível. A ativação do acesso e as renovações são orientadas pela equipe, sem renovação automática.' : 'Escolha um plano e siga para o pagamento. O fluxo prevê Pix e cartão, e a renovação é solicitada pela área do cliente. Nesta apresentação, os pagamentos e a entrega do acesso são simulados: não há cobrança real nem renovação automática.'},
];

export default function Storefront() {
  const [device, setDevice] = useState<TrialDevice | null>(null);
  const [invitationVisible, setInvitationVisible] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const selectedDevice = devices.find(item => item.id === device);
  const requestUrl = trialUrlForDevice(device);

  useEffect(() => {
    // The thumb-friendly shortcut only appears when the main invitations are out of view.
    const visibleInvitations = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.intersectionRatio >= 0.75) visibleInvitations.add(entry.target);
        else visibleInvitations.delete(entry.target);
      }
      setInvitationVisible(visibleInvitations.size > 0);
    }, {threshold: [0, 0.75, 1]});
    pageRef.current?.querySelectorAll('[data-trial-invitation]').forEach(link => observer.observe(link));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ap-site" ref={pageRef}>
      <div className="ap-demo">{isVercelHosted ? <>6 horas grátis para experimentar <span>·</span> Atendimento pelo WhatsApp</> : <>Prévia do site <span>·</span> Compras em demonstração, sem cobrança real.</>}</div>
      <header className="ap-header">
        <div className="ap-container ap-header-inner">
          <BrandLogo/>
          <nav aria-label="Navegação principal">
            <a href="#conteudo">Conteúdo</a><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a>
          </nav>
          <div className="ap-header-actions">
            <a className="ap-account" href="/area-do-cliente"><UserRound size={17}/><span>Minha conta</span></a>
            <a className="ap-button ap-header-cta" href={requestUrl} target="_blank" rel="noopener noreferrer">Testar grátis</a>
          </div>
        </div>
      </header>

      <main className="ap-main">
        <section className="ap-hero" aria-labelledby="ap-title">
          <figure className="ap-hero-media">
            {/* Original illustrative photography, not a preview of a content catalog. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/aperte-play-living-room.png" alt="Uma mão no controle remoto, pronta para dar play na televisão em uma sala aconchegante." width={1536} height={1024} fetchPriority="high"/>
            <div className="ap-trial-stamp" aria-hidden="true"><strong>{trialHours}h</strong><span>grátis para<br/>você testar</span></div>
            <figcaption>Imagem ilustrativa</figcaption>
          </figure>
          <div className="ap-container ap-hero-inner">
            <div className="ap-hero-copy" id="teste">
              <p className="ap-chip"><span/>TESTE GRÁTIS · {trialHours} HORAS</p>
              <h1 id="ap-title">Seu próximo<br/><span>play é grátis.</span></h1>
              <p className="ap-hero-description">TV ao vivo, filmes e séries na sua tela. <strong>{trialHours} horas para experimentar</strong> — depois, você decide se quer continuar.</p>
              <div className="ap-hero-actions">
                <a data-trial-invitation href={requestUrl} target="_blank" rel="noopener noreferrer" className="ap-button ap-hero-cta" aria-describedby="ap-trial-handoff"><MessageCircle size={20}/>Quero minhas {trialHours} horas grátis<ArrowRight size={18}/></a>
                <a className="ap-button ap-button-ghost" href="#planos">Ver planos</a>
              </div>
              <p id="ap-trial-handoff" className="ap-handoff">A mensagem já vai pronta. É só enviar no WhatsApp.</p>
              <fieldset className="ap-device-picker">
                <legend>Onde você quer dar play? <span>Opcional</span></legend>
                <div className="ap-device-options">
                  {devices.map(({id, label, Icon}) => (
                    <label className={'ap-device-option ' + (device === id ? 'is-selected' : '')} key={id}>
                      <input type="radio" name="trial-device" value={id} checked={device === id} onChange={() => setDevice(id)}/>
                      <Icon size={18} strokeWidth={1.8}/><span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="ap-device-guidance" aria-live="polite">{selectedDevice?.guidance ?? 'Escolha sua tela ou peça ajuda direto pelo WhatsApp.'}</p>
              <ul className="ap-trust"><li><Check size={15}/>Sem cartão</li><li><Check size={15}/>Sem cobrança automática</li><li><Check size={15}/>Atendimento no WhatsApp</li></ul>
            </div>
          </div>
        </section>

        <section className="ap-section ap-container" id="conteudo" aria-labelledby="ap-content-title">
          <div className="ap-section-head"><p className="ap-eyebrow">PARA TODO MUNDO DA CASA</p><h2 id="ap-content-title">Do jogo ao filme, é só dar play.</h2><p>Peça o catálogo à equipe antes de contratar.</p></div>
          <ul className="ap-genres">
            {genres.map(({id, label, Icon}) => <li key={id} className={'ap-genre ap-genre-' + id}><Icon size={30} strokeWidth={1.5} aria-hidden="true"/><span>{label}</span></li>)}
          </ul>
          <div className="ap-screens">
            <div><h3>Na tela que você preferir</h3><p>A equipe confirma a compatibilidade do seu aparelho antes de ativar.</p></div>
            <ul>{screens.map(({label, Icon}) => <li key={label}><Icon size={24} strokeWidth={1.6} aria-hidden="true"/><span>{label}</span></li>)}</ul>
          </div>
        </section>

        <section className="ap-section ap-container" id="como-funciona" aria-labelledby="ap-start-title">
          <div className="ap-section-head"><p className="ap-eyebrow">É MAIS SIMPLES DO QUE PARECE</p><h2 id="ap-start-title">Você escolhe a tela. A gente ajuda com o play.</h2><p>Sem preencher um cadastro para pedir seu teste.</p></div>
          <ol className="ap-steps">
            <li><span>1</span><h3>Chame no WhatsApp</h3><p>O botão já leva seu pedido e o aparelho escolhido.</p></li>
            <li><span>2</span><h3>Receba uma ajuda para começar</h3><p>A equipe confirma a compatibilidade, orienta e ativa o teste.</p></li>
            <li><span>3</span><h3>Curta suas {trialHours} horas grátis</h3><p>Experimente. Assinar depois é uma escolha sua.</p></li>
          </ol>
        </section>

        <section className="ap-section ap-container" id="planos" aria-labelledby="ap-plans-title">
          <div className="ap-section-head ap-section-head-center"><p className="ap-eyebrow">PARA QUANDO QUISER CONTINUAR</p><h2 id="ap-plans-title">Gostou do play? Fique à vontade.</h2><p>Escolha o tempo que combina com você. O valor é pelo período completo.</p></div>
          <div className="ap-plan-grid">
            {plans.map(plan => {
              const name = plan.name.replace('Aperte Play ', '');
              const months = planMonths[plan.id] ?? 1;
              const featured = plan.id === 'anual';
              return (
                <article key={plan.id} className={'ap-plan ' + (featured ? 'is-featured' : '')}>
                  {featured && <p className="ap-plan-badge">Mais economia</p>}
                  <h3>{name}</h3>
                  <p className="ap-plan-period">{plan.period} de acesso</p>
                  <p className="ap-plan-amount">{money(plan.amount)}</p>
                  <p className="ap-plan-note">{months > 1 ? <>Equivale a {money(Math.round(plan.amount / months))} por mês · <strong>economize {money(plans[0].amount * months - plan.amount)}</strong></> : 'Um mês para aproveitar'}</p>
                  <ul><li><UserRound size={16}/>{isVercelHosted ? 'Ativação orientada pela equipe' : 'Seu acesso na área do cliente'}</li><li><Headphones size={16}/>Orientações para configurar</li><li><ShieldCheck size={16}/>Você escolhe quando renovar</li></ul>
                  <a className={'ap-button ' + (featured ? '' : 'ap-button-ghost')} href={'/comprar?plano=' + plan.id}>Escolher {name.toLowerCase()}<ArrowRight size={18}/></a>
                </article>
              );
            })}
          </div>
          <p className="ap-plan-disclaimer">{isVercelHosted ? 'Checkout no site com Mercado Pago em ativação. Sem renovação automática.' : 'Sem renovação automática. Pagamento em demonstração.'} <a href="#teste">Prefiro experimentar primeiro</a></p>
        </section>

        <section className="ap-section ap-faq ap-container" id="duvidas" aria-labelledby="ap-faq-title">
          <div className="ap-section-head"><p className="ap-eyebrow">TUDO CLARO ANTES DO PLAY</p><h2 id="ap-faq-title">Pode perguntar.</h2><p>As respostas para começar com tranquilidade.</p></div>
          <div className="ap-faq-list">{faqs.map(faq => <details key={faq.q}><summary>{faq.q}<ChevronDown size={18}/></summary><p>{faq.a}</p></details>)}</div>
        </section>

        <section className="ap-last ap-container"><div className="ap-last-icon" aria-hidden="true"><Play size={24} fill="currentColor"/></div><div><h2>Seu primeiro play é por nossa conta.</h2><p>{trialHours} horas grátis. Você decide o próximo capítulo.</p></div><a data-trial-invitation className="ap-button" href={requestUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/>Pedir meu teste grátis<ArrowRight size={18}/></a></section>
      </main>
      <footer className="ap-footer ap-container"><BrandLogo/><p>O controle é seu.</p><a href={requestUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/>{whatsappDisplay}</a><a href="/area-do-cliente">Minha conta<ArrowRight size={14}/></a></footer>
      {!invitationVisible && <nav className="ap-mobile-dock" aria-label="Atalhos do site"><a href="#planos"><LayoutGrid size={19}/><span>Planos</span></a><a className="ap-button" href={requestUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/>{trialHours} horas grátis<ArrowRight size={16}/></a><a href="#duvidas"><CircleHelp size={19}/><span>Ajuda</span></a></nav>}
    </div>
  );
}
