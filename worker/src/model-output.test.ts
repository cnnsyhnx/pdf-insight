import { describe, expect, it } from 'vitest';
import { strictJsonSchema } from './model-output.ts';

type Node = Record<string, unknown>;

function objects(node: unknown, found: Node[] = []): Node[] {
  if (Array.isArray(node)) node.forEach((n) => objects(n, found));
  else if (node && typeof node === 'object') {
    const record = node as Node;
    if (record.type === 'object') found.push(record);
    Object.values(record).forEach((n) => objects(n, found));
  }
  return found;
}

describe('strictJsonSchema', () => {
  const schema = strictJsonSchema();

  it('closes every object and requires every key, as strict mode demands', () => {
    const all = objects(schema);
    expect(all.length).toBeGreaterThan(4);
    for (const object of all) {
      expect(object.additionalProperties).toBe(false);
      expect(object.required).toEqual(Object.keys(object.properties as Node));
    }
  });

  it('leaves out keywords strict mode may reject', () => {
    const text = JSON.stringify(schema);
    for (const keyword of ['"$schema"', '"minItems"', '"maxItems"', '"pattern"', '"format"']) {
      expect(text).not.toContain(keyword);
    }
  });
});
