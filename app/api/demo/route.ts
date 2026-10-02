import {getChatGPTUser} from '../../chatgpt-auth';
import {initialize,snapshot,createOrder,confirmOrder,cancelOrder,resetDemo,sendChat} from '../../../lib/store';
import {preview} from '../../../lib/domain';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const user=await getChatGPTUser();if(!user)return json(preview());await initialize(user.userId);return json(await snapshot(user.userId));}catch(e){console.error('demo_load_failed',e instanceof Error?e.message:'unknown');return json({error:'Não foi possível carregar a demonstração. Tente novamente.'},503);}}
export async function POST(request:Request){
 try{
 const user=await getChatGPTUser();if(!user)return json({error:'Entre para salvar a demonstração.',code:'SIGN_IN_REQUIRED'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem não permitida.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},415);
 const raw=await request.text();if(raw.length>4096)return json({error:'Pedido muito grande.'},413);
 let b;try{b=JSON.parse(raw)}catch{return json({error:'Dados inválidos.'},400)}
 await initialize(user.userId);let orderId;
 if(b.action==='create'){orderId=await createOrder(user.userId,String(b.planId),String(b.method),String(b.requestKey));}
 else if(b.action==='confirm'&&typeof b.orderId==='string'){await confirmOrder(user.userId,b.orderId);orderId=b.orderId;}
 else if(b.action==='cancel'&&typeof b.orderId==='string'){await cancelOrder(user.userId,b.orderId);}
 else if(b.action==='reset'&&b.confirm==='RESET_DEMO'&&['new','active'].includes(b.scenario)){await resetDemo(user.userId,b.scenario==='new');}
 else if(b.action==='chat'&&typeof b.message==='string'&&b.message.trim().length>0&&b.message.length<=800){await sendChat(user.userId,b.message.trim());}
 else return json({error:'Ação inválida.'},400);
 return json({...await snapshot(user.userId),orderId});
 }catch(e){const message=e instanceof Error?e.message:'';if(['INVALID_ORDER','ORDER_NOT_FOUND','ORDER_NOT_PAYABLE','ACCOUNT_NOT_FOUND'].includes(message))return json({error:message==='ORDER_NOT_PAYABLE'?'Este pedido venceu ou já foi cancelado. Crie um novo pagamento.':'Não foi possível concluir esse pedido.'},400);console.error('demo_action_failed',message);return json({error:'Não foi possível salvar. Seus dados permanecem disponíveis; tente novamente.'},503);}
}
