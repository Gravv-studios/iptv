import {ArrowLeft, ArrowUpRight, Headphones, MonitorPlay, RefreshCw} from 'lucide-react';
import {BrandLogo} from '../../components/brand-logo';
import {customerSupportUrl} from '../../lib/sales';
import '../mobile-storefront.css';
import '../public-service.css';

export default function PublicCustomerArea() {
  return <div className="ap-site ap-public">
    <header className="ap-header"><div className="ap-container ap-header-inner"><BrandLogo/><a className="ap-account" href="/"><ArrowLeft size={17}/>Início</a></div></header>
    <main className="ap-container ap-service-main ap-support-main">
      <section className="ap-service-copy">
        <p className="ap-service-kicker">JÁ É CLIENTE?</p>
        <h1>Vamos ajudar<br/><span>com seu acesso.</span></h1>
        <p>Para renovar, configurar seu aparelho ou tirar uma dúvida, fale com a equipe da Aperte Play.</p>
        <div className="ap-support-topics"><span><RefreshCw size={21}/>Renovação</span><span><MonitorPlay size={21}/>Instalação</span><span><Headphones size={21}/>Ajuda com o acesso</span></div>
        <a className="ap-button" href={customerSupportUrl} target="_blank" rel="noopener noreferrer">Falar com o atendimento<ArrowUpRight size={19}/></a>
        <p className="ap-service-fine">Acompanhe o pagamento na página do seu pedido. O checkout Mercado Pago aguarda a ativação da conta recebedora. O login e a renovação automática ainda estão em preparação; o suporte ao acesso acontece pelo WhatsApp.</p>
        <a className="ap-trial-alternative" href="/#planos">Consultar os planos disponíveis</a>
      </section>
    </main>
    <footer className="ap-service-footer ap-container">Aperte Play · Seu acesso, com orientação da equipe.</footer>
  </div>;
}
