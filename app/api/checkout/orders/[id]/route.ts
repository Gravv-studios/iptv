import {failure, json, ownedOrder} from '../../../../../lib/payments/http';
import {reconcileOrder} from '../../../../../lib/payments/mercado-pago';
import {publicOrder} from '../../../../../lib/payments/types';
import {whatsappConfig} from '../../../../../lib/whatsapp/config';
import {fulfillAndNotify} from '../../../../../lib/whatsapp/fulfill';
import {publicAccess} from '../../../../../lib/whatsapp/texts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const order = await reconcileOrder(await ownedOrder(request, (await params).id));
    // Only the browser session that created the order reaches this point, so it may see its own access.
    const result = order.status === 'approved' && order.mode === 'production' && whatsappConfig().ready ? await fulfillAndNotify(order) : null;
    return json({order: publicOrder(order), access: result && 'customer' in result && result.fresh ? publicAccess(result.customer) : null, activation: result ? result.state : null});
  } catch (error) { return failure(error); }
}
