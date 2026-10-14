import {checkOrigin,sessionToken,sessionHash} from '../../../../lib/payments/security';
import {requirePaymentConfig} from '../../../../lib/payments/config';
import {revokeAttribution} from '../../../../lib/payments/meta-conversions';
import {json,failure} from '../../../../lib/payments/http';
export const runtime='nodejs';
export async function POST(request:Request){try{const token=sessionToken(request);if(!token)return json({revoked:true});const config=requirePaymentConfig();checkOrigin(request,config.appUrl);await revokeAttribution(sessionHash(token,config.sessionSecret));return json({revoked:true});}catch(error){return failure(error);}}
