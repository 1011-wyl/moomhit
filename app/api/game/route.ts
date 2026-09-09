import { snapshot, command } from '@/lib/game/service.mjs';
export const dynamic = 'force-dynamic';
function local(req: Request) {
  const u = new URL(req.url);
  const host = req.headers.get('host')?.split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host || u.hostname)) return false;
  const o = req.headers.get('origin');
  return !o || o === u.origin;
}
export async function GET(req: Request) {
  if (!local(req))
    return Response.json({ error: '仅允许本机访问' }, { status: 403 });
  return Response.json(snapshot(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
export async function POST(req: Request) {
  if (
    !local(req) ||
    req.headers.get('content-type')?.split(';')[0] !== 'application/json'
  )
    return Response.json({ error: '请求来源不合法' }, { status: 403 });
  try {
    const text = await req.text();
    if (text.length > 50000) throw Error('请求过大');
    return Response.json(await command(JSON.parse(text)));
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
