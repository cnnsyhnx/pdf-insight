/*! PDF Insight API. Copyright (c) 2026 Can Seyhan (Jan). All rights reserved. See LICENSE. */
import { analyzeRequestSchema } from '../../src/lib/contract.ts';
import { AnalysisFailed, runAnalysis, type Provider } from './analyze.ts';
import type { Env } from './env.ts';
import { allowedOrigin, fail, json, preflight } from './http.ts';
import { takeDailySlot } from './limits.ts';
import { anthropic } from './providers/anthropic.ts';
import { openai } from './providers/openai.ts';

/** 200 000 characters of text fit even when JSON escapes many of them. */
const MAX_BODY_BYTES = 2_000_000;

/** Anthropic first, OpenAI as the fallback; a provider without a key is simply left out. */
export function configuredProviders(env: Env): Provider[] {
  const providers: Provider[] = [];
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (anthropicKey) providers.push(anthropic(anthropicKey, env.ANTHROPIC_MODEL));
  if (openaiKey) providers.push(openai(openaiKey, env.OPENAI_MODEL));
  return providers;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get('origin'), env.ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') return preflight(origin);
    if (url.pathname === '/health' && request.method === 'GET') return json(200, { ok: true }, origin);
    if (url.pathname !== '/analyze') return fail(404, 'not-found', origin);
    if (request.method !== 'POST') return fail(405, 'bad-request', origin, { allow: 'POST, OPTIONS' });
    // Browsers on other sites are turned away. Scripts can fake the header, which is what the limits below are for.
    if (!origin) return fail(403, 'origin', null);

    const providers = configuredProviders(env);
    if (providers.length === 0) return fail(503, 'not-configured', origin);

    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    const { success } = await env.PER_IP.limit({ key: ip });
    if (!success) return fail(429, 'rate-limit', origin, { 'retry-after': '60' });

    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return fail(413, 'too-large', origin);
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too-large', origin);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail(400, 'bad-request', origin);
    }
    const parsed = analyzeRequestSchema.safeParse(body);
    if (!parsed.success) {
      const tooLong = parsed.error.issues.some(
        (issue) =>
          (issue.code === 'too_big' && issue.path[0] === 'pages') ||
          (issue.code === 'custom' && issue.path.length === 0),
      );
      return tooLong ? fail(413, 'too-large', origin) : fail(400, 'bad-request', origin);
    }

    // Counted only for requests that will really reach a model.
    if (!(await takeDailySlot(env))) return fail(429, 'daily-limit', origin);

    try {
      const response = await runAnalysis(parsed.data, providers, {
        log: (event) => console.warn(JSON.stringify(event)),
      });
      return json(200, response, origin);
    } catch (error) {
      if (error instanceof AnalysisFailed) {
        return fail(error.code === 'invalid-response' ? 422 : 502, error.code, origin);
      }
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
