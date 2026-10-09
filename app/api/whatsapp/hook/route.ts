import {json} from '../../../../lib/payments/http';
import {readJson} from '../../../../lib/payments/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Temporary: learns the structure of BotBot device webhooks. Logs field names, types and sizes, never the values.
function shape(value: unknown, depth = 0): string {
  if (Array.isArray(value)) return `[${value.length}${value.length && depth < 3 ? ' ' + shape(value[0], depth + 1) : ''}]`;
  if (value && typeof value === 'object') {
    return depth >= 3 ? '{…}' : `{${Object.entries(value as Record<string, unknown>).slice(0, 40).map(([name, item]) => `${name.slice(0, 30)}:${shape(item, depth + 1)}`).join(' ')}}`;
  }
  if (typeof value === 'string') {
    const suffix = /@(lid|s\.whatsapp\.net|g\.us|c\.us)$/.exec(value)?.[0] ?? '';
    return `s${value.length}${/^\d+$/.test(value) ? 'd' : ''}${suffix}`;
  }
  return value === null ? 'null' : typeof value;
}
export async function POST(request: Request) {
  try { console.info('whatsapp_hook_shape', shape(await readJson(request, 60000)).slice(0, 3500)); }
  catch { console.info('whatsapp_hook_shape', 'unreadable', request.headers.get('content-type') ?? ''); }
  return json({received: true});
}
