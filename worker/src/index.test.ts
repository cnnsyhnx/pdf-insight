import { describe, expect, it } from 'vitest';
import type { Env } from './env.ts';
import { allowedOrigin } from './http.ts';
import worker, { configuredProviders } from './index.ts';

const ORIGIN = 'https://cnnsyhnx.github.io';

function env(overrides: Partial<Env> = {}): Env {
  const store = new Map<string, string>();
  return {
    ANTHROPIC_MODEL: 'claude-sonnet-5-5',
    OPENAI_MODEL: 'gpt-5.4-mini',
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
    DAILY_LIMIT: '30',
    PER_IP: { limit: () => Promise.resolve({ success: true }) },
    COUNTERS: {
      get: (key: string) => Promise.resolve(store.get(key) ?? null),
      put: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
    } as unknown as KVNamespace,
    ...overrides,
  };
}

function call(init: RequestInit & { path?: string; origin?: string | null }, e: Env = env()) {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
  const request = new Request(`https://api.example${init.path ?? '/analyze'}`, { ...init, headers });
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], e);
}

const body = JSON.stringify({ fileName: 'a.pdf', pages: ['tekst'] });

describe('allowedOrigin', () => {
  it('accepts only exact entries of the list', () => {
    const list = `${ORIGIN}, http://localhost:5173/`;
    expect(allowedOrigin(ORIGIN, list)).toBe(ORIGIN);
    expect(allowedOrigin('http://localhost:5173', list)).toBe('http://localhost:5173');
    expect(allowedOrigin('https://cnnsyhnx.github.io.evil.example', list)).toBeNull();
    expect(allowedOrigin(null, list)).toBeNull();
  });
});

describe('configuredProviders', () => {
  it('orders Anthropic before OpenAI and skips a missing key', () => {
    expect(
      configuredProviders(env({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' })).map((p) => p.name),
    ).toEqual(['anthropic', 'openai']);
    expect(
      configuredProviders(env({ ANTHROPIC_API_KEY: ' ', OPENAI_API_KEY: 'o' })).map((p) => p.name),
    ).toEqual(['openai']);
  });
});

describe('worker', () => {
  it('answers the CORS preflight for allowed origins only', async () => {
    const allowed = await call({ method: 'OPTIONS' });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const other = await call({ method: 'OPTIONS', origin: 'https://example.com' });
    expect(other.status).toBe(403);
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('turns away other origins', async () => {
    const response = await call({ method: 'POST', body, origin: 'https://example.com' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'origin' });
  });

  it('says when no API key is set', async () => {
    const response = await call({ method: 'POST', body });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not-configured' });
  });

  it('rejects a body that does not match the contract', async () => {
    const e = env({ OPENAI_API_KEY: 'o' });
    expect((await call({ method: 'POST', body: '{', origin: ORIGIN }, e)).status).toBe(400);
    expect(
      (await call({ method: 'POST', body: JSON.stringify({ fileName: 'a.pdf', pages: [] }) }, e)).status,
    ).toBe(400);
    const long = JSON.stringify({
      fileName: 'a.pdf',
      pages: ['x'.repeat(90_000), 'x'.repeat(90_000), 'x'.repeat(30_000)],
    });
    expect((await call({ method: 'POST', body: long }, e)).status).toBe(413);
  });

  it('applies the per-IP limit', async () => {
    const e = env({ OPENAI_API_KEY: 'o', PER_IP: { limit: () => Promise.resolve({ success: false }) } });
    const response = await call({ method: 'POST', body }, e);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate-limit' });
  });

  it('stops at the daily limit', async () => {
    const spent = { get: () => Promise.resolve('30') } as unknown as KVNamespace;
    const e = env({ OPENAI_API_KEY: 'o', COUNTERS: spent });
    const response = await call({ method: 'POST', body }, e);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'daily-limit' });
  });

  it('has no other routes', async () => {
    expect((await call({ method: 'GET', path: '/' })).status).toBe(404);
    expect((await call({ method: 'GET' })).status).toBe(405);
  });
});
