import Anthropic, { APIConnectionError, APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Provider } from '../analyze.ts';
import { InvalidAnswer, ProviderDown } from '../errors.ts';
import { modelOutputSchema } from '../model-output.ts';

// Structured output: the API constrains the answer to this JSON schema; the Worker still validates it with Zod.
const FORMAT = betaZodOutputFormat(modelOutputSchema);

/** Claude, asked first. */
export function anthropic(apiKey: string, model: string): Provider {
  // No SDK retries: if Anthropic cannot answer now, OpenAI is asked instead of waiting.
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return {
    name: 'anthropic',
    async ask(prompt, timeoutMs) {
      const message = await client.beta.messages
        .create(
          {
            model,
            max_tokens: 16_000,
            system: prompt.system,
            messages: [{ role: 'user', content: prompt.user }],
            output_config: { effort: 'low', format: FORMAT },
            // If a safety classifier declines the request, Anthropic re-runs it on its recommended model.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          { timeout: timeoutMs },
        )
        .catch((error: unknown) => {
          throw new ProviderDown('anthropic', reasonOf(error));
        });

      if (message.stop_reason === 'refusal') throw new ProviderDown('anthropic', 'refusal');
      if (message.stop_reason === 'max_tokens') {
        throw new InvalidAnswer(
          'anthropic',
          'The answer was cut off by the output limit. Keep values short.',
        );
      }
      // After a server-side fallback, the answer is what follows the last fallback block.
      const after = message.content.findLastIndex((block) => block.type === 'fallback');
      const text = message.content
        .slice(after + 1)
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      const usage = { input: message.usage.input_tokens, output: message.usage.output_tokens };
      return { text, model: message.model, usage };
    },
  };
}

function reasonOf(error: unknown): string {
  if (error instanceof APIConnectionTimeoutError) return 'timeout';
  if (error instanceof APIConnectionError) return 'connection failed';
  if (error instanceof APIError) return `HTTP ${error.status ?? '?'}${error.type ? ` ${error.type}` : ''}`;
  return error instanceof Error ? error.name : 'unknown error';
}
