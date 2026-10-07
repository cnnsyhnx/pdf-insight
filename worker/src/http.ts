import type { WorkerError } from '../../src/lib/contract.ts';

/** The request's origin if it is on the allow list (exact match), otherwise null. */
export function allowedOrigin(origin: string | null, allowList: string): string | null {
  if (!origin) return null;
  const allowed = allowList.split(',').map((o) => o.trim().replace(/\/$/, ''));
  return allowed.includes(origin) ? origin : null;
}

function baseHeaders(origin: string | null, extra?: Record<string, string>): Headers {
  const headers = new Headers(extra);
  headers.set('vary', 'Origin');
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type');
    headers.set('access-control-max-age', '86400');
  }
  return headers;
}

export function json(
  status: number,
  body: unknown,
  origin: string | null,
  extra?: Record<string, string>,
): Response {
  const headers = baseHeaders(origin, extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

export function fail(
  status: number,
  error: WorkerError,
  origin: string | null,
  extra?: Record<string, string>,
): Response {
  return json(status, { error }, origin, extra);
}

export function preflight(origin: string | null): Response {
  return new Response(null, { status: origin ? 204 : 403, headers: baseHeaders(origin) });
}
