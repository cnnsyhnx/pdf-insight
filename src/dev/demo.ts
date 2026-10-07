import { analysisResponseSchema, type AnalysisResponse } from '../lib/analysis.ts';

/**
 * Development only. `?demo` replays a saved backend answer for a local PDF, so the screens can be designed and
 * reviewed without spending API calls. Both files live in public/demo/, which is git-ignored and never deployed.
 */
export function isDemo(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
}

export async function loadDemo(): Promise<{ file: File; answer: () => Promise<AnalysisResponse> }> {
  const base = import.meta.env.BASE_URL;
  const [pdf, json] = await Promise.all([
    fetch(`${base}demo/sample.pdf`).then((r) => r.blob()),
    fetch(`${base}demo/response.json`).then((r): Promise<unknown> => r.json()),
  ]);
  const response = analysisResponseSchema.parse(json);
  const file = new File([pdf], response.insight.document.fileName, { type: 'application/pdf' });
  const delay = Number(new URLSearchParams(window.location.search).get('delay') ?? 2400);
  return {
    file,
    answer: () => new Promise((resolve) => setTimeout(() => resolve(response), delay)),
  };
}
