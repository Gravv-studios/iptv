export const DAY=86400000;
export const plans=[
 {id:'mensal',name:'Lume Mensal',days:30,amount:2990,tag:'Flexibilidade para começar'},
 {id:'trimestral',name:'Lume Trimestral',days:90,amount:7990,tag:'Mais tempo para aproveitar'},
 {id:'semestral',name:'Lume Semestral',days:180,amount:14990,tag:'Seu próximo semestre de play'}
] as const;
export type PlanId=typeof plans[number]['id'];
export type Account={user_id:string;customer_name:string;plan_id:PlanId;expires_at:number;username:string;password:string;created_at:number};
export type Order={id:string;plan_id:PlanId;amount:number;days:number;method:'pix'|'card';kind:'purchase'|'renewal';status:'pending'|'paid'|'cancelled'|'expired';created_at:number;expires_at:number;paid_at:number|null;applied:number};
export type Message={id:string;role:'user'|'assistant';body:string;created_at:number};
export type Snapshot={account:Account;orders:Order[];messages:Message[];authenticated:boolean;mode:'demo';serverNow:number};
export const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
export const date=(value:number)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(value));
export const getPlan=(id:string)=>plans.find(p=>p.id===id);
export function renewalExpiry(current:number,now:number,days:number){return Math.max(current,now)+days*DAY;}
export function preview(now=Date.now()):Snapshot{return {account:{user_id:'preview',customer_name:'Cliente de exemplo',plan_id:'mensal',expires_at:now+7*DAY,username:'lume_demo',password:'DEMO-sem-acesso',created_at:now-23*DAY},orders:[],messages:[],authenticated:false,mode:'demo',serverNow:now};}
export function assistantReply(message:string,account:Account,now=Date.now()){
 const s=message.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/whats|humano|atendente|pessoa/.test(s))return 'O atendimento por WhatsApp será conectado ao número da empresa. Nesta apresentação, você pode conhecer o fluxo de conversa aqui no site. Nenhuma mensagem é enviada para fora do portal.';
 if(/renov|venc|valid|expir/.test(s))return `A validade do acesso de exemplo é ${date(account.expires_at)}. Abra Minha assinatura, escolha um período e avance para o pagamento de demonstração. A renovação soma os dias ao saldo que ainda estiver válido. Não há débito automático nesta versão.`;
 if(/paga|pix|cartao|cobr|compra/.test(s))return 'Você pode experimentar Pix ou cartão sem informar dados bancários. Crie o pedido e clique em Simular pagamento aprovado. A tela atualizará o acesso e o histórico. Na operação real, isso dependerá da confirmação do serviço de pagamento escolhido.';
 if(/senha|login|acesso|key|chave/.test(s))return 'Seus dados de exemplo ficam em Visão geral, no cartão Seu acesso IPTV. Você pode revelar e copiar a senha. Eles servem apenas para a apresentação e não abrem um serviço de IPTV.';
 if(/app|instal|tv|assist|celular|computador/.test(s))return 'Abra Como assistir e selecione seu aparelho. O aplicativo e os links de instalação serão definidos com o fornecedor de IPTV; por enquanto, mostramos as etapas gerais sem indicar um aplicativo não validado.';
 return 'Posso ajudar com acesso e senha, renovação, pagamentos e instalação. Escolha um desses assuntos ou descreva sua dúvida. Este atendimento é uma demonstração com respostas por assunto; casos fora desse roteiro precisarão de atendimento humano.';
}
