/** Saves a value as a pretty-printed .json file. */
export function downloadJson(value: unknown, fileName: string): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** "umowa_14-2026.pdf" -> "umowa_14-2026.insight.json". */
export const jsonFileName = (pdfName: string): string =>
  `${pdfName.replace(/\.pdf$/i, '') || 'dokument'}.insight.json`;
