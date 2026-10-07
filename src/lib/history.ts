import { z } from 'zod';
import { exportSchema, type ExportJson } from './analysis.ts';

const STORAGE_KEY = 'pdf-insight:history:v1';
const LIMIT = 6;

const entrySchema = z.object({
  id: z.string(),
  savedAt: z.iso.datetime(),
  pages: z.number().int().positive(),
  result: exportSchema,
});

export type HistoryEntry = z.infer<typeof entrySchema>;

/** Recent results, newest first. Stored data is validated like any other input; broken entries are dropped. */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const parsed = entrySchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

/** Keeps the last few results in this browser only. The PDF itself is never stored. */
export function saveToHistory(result: ExportJson, pages: number): HistoryEntry[] {
  const entry: HistoryEntry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), pages, result };
  const next = [
    entry,
    ...loadHistory().filter((e) => e.result.document.fileName !== result.document.fileName),
  ];
  const trimmed = next.slice(0, LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Full or blocked storage: the result is still on screen, only the history is skipped.
  }
  return trimmed;
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // See saveToHistory.
  }
  return next;
}
