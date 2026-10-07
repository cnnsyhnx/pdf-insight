import { z } from 'zod';
import {
  analysisResponseSchema,
  MAX_PAGE_CHARS,
  MAX_PAGES,
  MAX_TEXT_CHARS,
  type AnalysisResponse,
  type AnalyzeRequest,
} from '../lib/contract.ts';

export type ApiProblem =
  'network' | 'rate-limit' | 'daily-limit' | 'too-long' | 'invalid-response' | 'upstream' | 'server';

export class ApiError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem);
    this.problem = problem;
  }
}

const errorBody = z.object({ error: z.string() });
const TIMEOUT_MS = 60_000;

/** The same limits the server enforces, checked before sending so a long document fails fast and clearly. */
export function isTooLong({ pages }: AnalyzeRequest): boolean {
  const chars = pages.reduce((n, p) => n + p.length, 0);
  return pages.length > MAX_PAGES || chars > MAX_TEXT_CHARS || pages.some((p) => p.length > MAX_PAGE_CHARS);
}

/**
 * Sends the document text to the backend and validates the answer before anything is shown.
 * Only the text of each page leaves the browser, never the PDF file.
 */
export async function analyze(request: AnalyzeRequest, signal: AbortSignal): Promise<AnalysisResponse> {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new ApiError('network');
  if (isTooLong(request)) throw new ApiError('too-long');

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.any([signal, timeout]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError('network');
  }

  if (!response.ok) {
    const body = errorBody.safeParse(await response.json().catch(() => null));
    const code = body.success ? body.data.error : '';
    if (response.status === 429) throw new ApiError(code === 'daily-limit' ? 'daily-limit' : 'rate-limit');
    if (response.status === 413) throw new ApiError('too-long');
    if (response.status === 422) throw new ApiError('invalid-response');
    if (response.status === 502 || response.status === 504) throw new ApiError('upstream');
    throw new ApiError('server');
  }

  const parsed = analysisResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ApiError('invalid-response');
  return parsed.data;
}
