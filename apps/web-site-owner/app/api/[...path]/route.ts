import { NextRequest, NextResponse } from 'next/server';

// Headers that must not cross a proxy hop (RFC 7230 §6.1).
const HOP_BY_HOP_REQ = new Set([
  'connection',
  'host',            // replaced by fetch's own DNS resolution of the upstream
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',  // recalculated by fetch from the forwarded ArrayBuffer
]);

const HOP_BY_HOP_RES = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

// Methods that may carry a request body.
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Next.js 14 App Router: params is synchronous. In Next.js 15 params becomes a Promise —
// when we upgrade, change to: { params: Promise<{ path: string[] }> } and await params
// before reading params.path.
async function proxy(
  req: NextRequest,
  { params }: { params: { path: string[] } },
): Promise<NextResponse> {
  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) {
    return NextResponse.json(
      { success: false, error: 'API_BASE_URL is not configured on this deployment.' },
      { status: 503 },
    );
  }

  const base = apiBase.replace(/\/$/, '');
  const path = params.path.join('/');
  const targetUrl = `${base}/api/${path}${req.nextUrl.search}`;

  // Forward all incoming headers except hop-by-hop ones.
  // Cookie and Authorization are carried through here unchanged.
  const forwardHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (HOP_BY_HOP_REQ.has(key.toLowerCase())) continue;
    forwardHeaders.set(key, value);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  const fetchInit: RequestInit = {
    method: req.method,
    headers: forwardHeaders,
    redirect: 'manual', // pass 3xx through to the browser; do not follow
    signal: controller.signal,
  };
  if (BODY_METHODS.has(req.method)) {
    fetchInit.body = await req.arrayBuffer();
  }

  const start = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, fetchInit);
  } catch {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (controller.signal.aborted) {
      console.log(`[proxy] ${req.method} ${path} -> timeout (${duration}ms)`);
      return NextResponse.json(
        { success: false, error: 'Upstream API timed out' },
        { status: 504 },
      );
    }
    console.log(`[proxy] ${req.method} ${path} -> unreachable (${duration}ms)`);
    return NextResponse.json(
      { success: false, error: 'Upstream API unreachable' },
      { status: 502 },
    );
  }
  clearTimeout(timeoutId);
  const duration = Date.now() - start;

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (HOP_BY_HOP_RES.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === 'set-cookie') continue; // handled separately below
    responseHeaders.set(key, value);
  }

  // Headers.get('set-cookie') merges multiple values with commas, which breaks
  // cookie parsing. getSetCookie() returns each value as a separate string.
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  console.log(`[proxy] ${req.method} ${path} -> ${upstream.status} (${duration}ms)`);

  // Pipe the upstream body (or null for 204/HEAD) straight to the client.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
