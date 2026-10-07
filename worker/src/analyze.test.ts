import { describe, expect, it } from 'vitest';
import type { AnalyzeRequest } from '../../src/lib/contract.ts';
import {
  AnalysisFailed,
  DEADLINE_MS,
  RESERVE_MS,
  runAnalysis,
  type Prompt,
  type Provider,
} from './analyze.ts';
import { InvalidAnswer, ProviderDown, type ProviderName } from './errors.ts';
import type { ModelOutput } from './model-output.ts';

const request: AnalyzeRequest = { fileName: 'oferta.pdf', pages: ['Oferta na 1 000 zł.'] };

const valid: ModelOutput = {
  language: 'pl',
  type: 'oferta',
  title: null,
  date: null,
  summarySentences: ['Jedno.', 'Dwa.', 'Trzy.'],
  summaryQuotes: [],
  keyPoints: ['A', 'B', 'C'],
  organizations: [],
  people: [],
  amounts: [],
  dates: [],
  keywords: ['oferta'],
};

type Step = string | Error;

/** A provider that plays back the given answers in order and records what it was asked. */
function scripted(name: ProviderName, steps: Step[]) {
  const calls: { prompt: Prompt; timeoutMs: number }[] = [];
  const provider: Provider = {
    name,
    ask(prompt, timeoutMs) {
      calls.push({ prompt, timeoutMs });
      const step = steps[calls.length - 1];
      if (step === undefined) throw new Error('unexpected call');
      if (step instanceof Error) return Promise.reject(step);
      return Promise.resolve({ text: step, model: `${name}-model` });
    },
  };
  return { provider, calls };
}

const ok = JSON.stringify(valid);
const broken = JSON.stringify({ ...valid, summarySentences: ['Tylko jedno.'] });

describe('runAnalysis', () => {
  it('uses Anthropic when it answers', async () => {
    const a = scripted('anthropic', [ok]);
    const o = scripted('openai', []);
    const result = await runAnalysis(request, [a.provider, o.provider]);
    expect(result.meta.provider).toBe('anthropic');
    expect(result.meta.model).toBe('anthropic-model');
    expect(o.calls).toHaveLength(0);
  });

  it('falls back to OpenAI when Anthropic does not answer', async () => {
    const a = scripted('anthropic', [new ProviderDown('anthropic', 'HTTP 529 overloaded_error')]);
    const o = scripted('openai', [ok]);
    const events: Record<string, unknown>[] = [];
    const result = await runAnalysis(request, [a.provider, o.provider], { log: (e) => events.push(e) });
    expect(result.meta.provider).toBe('openai');
    expect(events).toContainEqual({
      event: 'provider-down',
      provider: 'anthropic',
      reason: 'HTTP 529 overloaded_error',
    });
  });

  it('retries an invalid answer once, telling the model what was wrong', async () => {
    const a = scripted('anthropic', [broken, ok]);
    const result = await runAnalysis(request, [a.provider]);
    expect(result.meta.provider).toBe('anthropic');
    expect(a.calls).toHaveLength(2);
    expect(a.calls[0]?.prompt.user).not.toContain('failed validation');
    expect(a.calls[1]?.prompt.user).toContain('failed validation');
    expect(a.calls[1]?.prompt.user).toContain('summarySentences');
  });

  it('reports a second invalid answer instead of showing it', async () => {
    const a = scripted('anthropic', [broken, new InvalidAnswer('anthropic', 'cut off')]);
    const o = scripted('openai', [ok]);
    await expect(runAnalysis(request, [a.provider, o.provider])).rejects.toEqual(
      new AnalysisFailed('invalid-response'),
    );
    expect(o.calls).toHaveLength(0);
  });

  it('starts the fallback provider without the first one feedback', async () => {
    const a = scripted('anthropic', [broken, new ProviderDown('anthropic', 'timeout')]);
    const o = scripted('openai', [ok]);
    await runAnalysis(request, [a.provider, o.provider]);
    expect(o.calls[0]?.prompt.user).not.toContain('failed validation');
  });

  it('says upstream when no provider answers', async () => {
    const a = scripted('anthropic', [new ProviderDown('anthropic', 'HTTP 401 authentication_error')]);
    const o = scripted('openai', [new ProviderDown('openai', 'HTTP 429 insufficient_quota')]);
    await expect(runAnalysis(request, [a.provider, o.provider])).rejects.toEqual(
      new AnalysisFailed('upstream'),
    );
  });

  it('keeps time back for the fallback and stays inside the deadline', async () => {
    let clock = 0;
    const a = scripted('anthropic', [new ProviderDown('anthropic', 'timeout')]);
    const o = scripted('openai', [ok]);
    const slowA: Provider = {
      ...a.provider,
      ask: (prompt, timeoutMs) => {
        clock += timeoutMs;
        return a.provider.ask(prompt, timeoutMs);
      },
    };
    await runAnalysis(request, [slowA, o.provider], { now: () => clock });
    expect(a.calls[0]?.timeoutMs).toBe(DEADLINE_MS - RESERVE_MS);
    expect(o.calls[0]?.timeoutMs).toBe(RESERVE_MS);
  });

  it('puts the document inside a boundary that changes per request', async () => {
    const a = scripted('anthropic', [ok]);
    await runAnalysis(request, [a.provider], { boundary: 'b-123' });
    const user = a.calls[0]?.prompt.user ?? '';
    expect(user).toContain('<document boundary="b-123">');
    expect(user).toContain('</document boundary="b-123">');
    expect(user.indexOf('Oferta na 1 000 zł.')).toBeGreaterThan(user.indexOf('<document boundary="b-123">'));
  });
});
