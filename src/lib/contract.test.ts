import { describe, expect, it } from 'vitest';
import {
  analyzeRequestSchema,
  MAX_CHARS_PER_PAGE,
  MAX_PAGE_CHARS,
  MAX_PAGES,
  MAX_TEXT_CHARS,
} from './contract.ts';

const request = (pages: string[]) => ({ fileName: 'umowa.pdf', pages });
const text = (chars: number) => 'a'.repeat(chars);
const accepted = (pages: string[]) => analyzeRequestSchema.safeParse(request(pages)).success;

describe('the limits of one analysis', () => {
  it('are 50 pages and the text that 50 dense pages hold', () => {
    expect(MAX_PAGES).toBe(50);
    expect(MAX_TEXT_CHARS).toBe(MAX_PAGES * MAX_CHARS_PER_PAGE);
    expect(MAX_TEXT_CHARS).toBe(200_000);
  });

  it('let a 50-page document through right at the character limit', () => {
    expect(accepted(Array.from({ length: MAX_PAGES }, () => text(MAX_CHARS_PER_PAGE)))).toBe(true);
  });

  it('turn away a 51st page', () => {
    expect(accepted(Array.from({ length: MAX_PAGES + 1 }, () => text(10)))).toBe(false);
  });

  it('turn away a single character over the limit', () => {
    const pages = Array.from({ length: MAX_PAGES }, () => text(MAX_CHARS_PER_PAGE));
    pages[0] = text(MAX_CHARS_PER_PAGE + 1);
    expect(accepted(pages)).toBe(false);
  });

  it('turn away one page denser than any real page', () => {
    expect(accepted([text(MAX_PAGE_CHARS)])).toBe(true);
    expect(accepted([text(MAX_PAGE_CHARS + 1)])).toBe(false);
  });
});
