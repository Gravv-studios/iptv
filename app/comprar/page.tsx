import Checkout from './checkout';
import {requireChatGPTUser} from '../chatgpt-auth';
import {getPlan,getHistoricalPlan,type PlanId} from '../../lib/domain';
import './checkout.css';
import {isVercelHosted} from '../../lib/hosting';
import PublicPurchase from './public-purchase';
export const dynamic='force-dynamic';
export const metadata={title:'Finalizar contratação · Aperte Play'};
async function AuthenticatedCheckout({planId,orderId}:{planId:PlanId;orderId?:string}){if(isVercelHosted)return <PublicPurchase initialPlanId={getPlan(planId)?.id??'mensal'}/>;const returnTo='/comprar?plano='+planId+(orderId?'&pedido='+encodeURIComponent(orderId):'');await requireChatGPTUser(returnTo);return <Checkout initialPlanId={planId}/>;}
export default async function Purchase({searchParams}:{searchParams:Promise<{plano?:string|string[];pedido?:string|string[]}>}){const params=await searchParams;const raw=typeof params.plano==='string'?params.plano:'mensal';const plan=getPlan(raw)??(typeof params.pedido==='string'?getHistoricalPlan(raw):undefined);if(!plan)return <div className="invalid-plan"><h1>Esse plano não foi encontrado.</h1><p>Escolha um dos períodos disponíveis para continuar.</p><a href="/#planos">Ver planos da Aperte Play</a></div>;return <AuthenticatedCheckout planId={plan.id} orderId={typeof params.pedido==='string'?params.pedido:undefined}/>;}
