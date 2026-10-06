import {failure, json, ownedOrder} from '../../../../../lib/payments/http';
import {reconcileOrder} from '../../../../../lib/payments/mercado-pago';
import {publicOrder} from '../../../../../lib/payments/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  try { return json({order: publicOrder(await reconcileOrder(await ownedOrder(request, (await params).id)))}); }
  catch (error) { return failure(error); }
}
