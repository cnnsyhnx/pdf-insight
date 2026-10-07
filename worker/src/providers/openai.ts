import { z } from 'zod';
import type { Provider } from '../analyze.ts';
import { InvalidAnswer, ProviderDown } from '../errors.ts';
import { strictJsonSchema } from '../model-output.ts';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const SCHEMA = strictJsonSchema();

const completionSchema = z.object({
  model: z.string(),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable(),
        message: z.object({ content: z.string().nullable(), refusal: z.string().nullish() }),
      }),
    )
    .min(1),
});

const errorSchema = z.object({ error: z.object({ code: z.string().nullish(), type: z.string().nullish() }) });

/** OpenAI, asked only when Anthropic does not answer. Plain fetch, so the Worker needs no second SDK. */
export function openai(apiKey: string, model: string): Provider {
  return {
    name: 'openai',
    async ask(prompt, timeoutMs) {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'developer', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'document_insight', strict: true, schema: SCHEMA },
            },
            reasoning_effort: 'low',
            max_completion_tokens: 16_000,
            store: false,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        throw new ProviderDown('openai', timedOut ? 'timeout' : 'connection failed');
      }

      if (!response.ok) {
        const body = errorSchema.safeParse(await response.json().catch(() => null));
        const code = body.success ? (body.data.error.code ?? body.data.error.type) : null;
        throw new ProviderDown('openai', `HTTP ${response.status}${code ? ` ${code}` : ''}`);
      }

      const body = completionSchema.safeParse(await response.json().catch(() => null));
      const choice = body.success ? body.data.choices[0] : undefined;
      if (!body.success || !choice) throw new ProviderDown('openai', 'unexpected response');
      if (choice.message.refusal) throw new ProviderDown('openai', 'refusal');
      if (choice.finish_reason === 'length') {
        throw new InvalidAnswer('openai', 'The answer was cut off by the output limit. Keep values short.');
      }
      const { usage } = body.data;
      return {
        text: choice.message.content ?? '',
        model: body.data.model,
        usage: usage && { input: usage.prompt_tokens, output: usage.completion_tokens },
      };
    },
  };
}
