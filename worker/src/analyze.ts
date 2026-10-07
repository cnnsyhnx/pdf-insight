import type { AnalysisResponse, AnalyzeRequest } from '../../src/lib/contract.ts';
import { InvalidAnswer, ProviderDown, type ProviderName } from './errors.ts';
import { buildUserContent, SYSTEM_PROMPT } from './prompt.ts';
import { checkModelText } from './response.ts';

export interface Prompt {
  system: string;
  user: string;
}

export interface Answer {
  text: string;
  /** The model that actually answered, as the provider reports it. */
  model: string;
  /** Tokens billed for this answer, for the cost line in the logs. */
  usage?: { input: number; output: number };
}

export interface Provider {
  name: ProviderName;
  /** Resolves with the raw answer; throws ProviderDown when there is none, InvalidAnswer when it is unusable. */
  ask(prompt: Prompt, timeoutMs: number): Promise<Answer>;
}

export class AnalysisFailed extends Error {
  readonly code: 'invalid-response' | 'upstream';

  constructor(code: 'invalid-response' | 'upstream') {
    super(code);
    this.code = code;
  }
}

/** The browser gives up after 60 s, so the Worker answers before that, with an error if it has to. */
export const DEADLINE_MS = 55_000;
/** Time kept back for the next provider while the current one is still being waited on. */
export const RESERVE_MS = 20_000;
/** With less time than this left, an attempt is not worth starting. */
const MIN_ATTEMPT_MS = 5_000;
/** The first answer that fails validation gets one corrected retry; the second ends the analysis. */
const MAX_INVALID = 2;

export interface RunOptions {
  now?: () => number;
  boundary?: string;
  log?: (event: Record<string, unknown>) => void;
}

/**
 * Asks the providers in order (Anthropic, then OpenAI) until one returns an answer that passes the schema.
 * A provider that does not answer hands over to the next one; an invalid answer is retried once with the
 * list of problems, and a second invalid answer is reported as such instead of being shown.
 */
export async function runAnalysis(
  request: AnalyzeRequest,
  providers: Provider[],
  options: RunOptions = {},
): Promise<AnalysisResponse> {
  const now = options.now ?? Date.now;
  const started = now();
  // A fresh boundary per request: text inside the PDF cannot guess it to close the document early.
  const boundary = options.boundary ?? crypto.randomUUID();
  let invalid = 0;

  for (const [index, provider] of providers.entries()) {
    const reserve = index < providers.length - 1 ? RESERVE_MS : 0;
    let feedback: string | null = null;

    for (;;) {
      const timeout = DEADLINE_MS - (now() - started) - reserve;
      if (timeout < MIN_ATTEMPT_MS) {
        options.log?.({ event: 'provider-skipped', provider: provider.name, reason: 'no time left' });
        break;
      }
      const prompt = { system: SYSTEM_PROMPT, user: buildUserContent(request, boundary, feedback) };

      let problems: string[];
      try {
        const answer = await provider.ask(prompt, timeout);
        const meta = { model: answer.model, provider: provider.name, durationMs: now() - started };
        options.log?.({ event: 'answered', ...meta, usage: answer.usage });
        const checked = checkModelText(answer.text, request, meta);
        if (checked.ok) return checked.response;
        problems = checked.problems;
      } catch (error) {
        if (error instanceof ProviderDown) {
          options.log?.({ event: 'provider-down', provider: provider.name, reason: error.reason });
          break;
        }
        if (!(error instanceof InvalidAnswer)) throw error;
        problems = [`- ${error.reason}`];
      }

      invalid += 1;
      options.log?.({ event: 'invalid-answer', provider: provider.name, attempt: invalid, problems });
      if (invalid >= MAX_INVALID) throw new AnalysisFailed('invalid-response');
      feedback = problems.join('\n');
    }
  }
  throw new AnalysisFailed('upstream');
}
