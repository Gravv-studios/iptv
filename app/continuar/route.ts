import {validTrialPaymentLink} from '../../lib/whatsapp/trial-payment-link';
import {trialRenewalUrl} from '../../lib/whatsapp/trial-limit-supplier';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:Request) {
  const url=new URL(request.url),id=url.searchParams.get('acesso')??'',sig=url.searchParams.get('assinatura')??'';
  if(!validTrialPaymentLink(id,sig,process.env.WHATSAPP_BOT_SECRET??'')) return new Response('Este link não é válido. Abra o link enviado pela Aperte Play ou peça ajuda pelo WhatsApp.',{status:400,headers});
  try {return new Response(null,{status:302,headers:{...headers,Location:await trialRenewalUrl(id)}});}
  catch {return new Response('Não foi possível abrir seu pagamento agora. Tente novamente em alguns instantes ou responda ajuda no WhatsApp da Aperte Play.',{status:503,headers});}
}
