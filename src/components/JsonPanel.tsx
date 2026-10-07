import { useId, useMemo, useState, type ReactNode } from 'react';
import { copy } from '../copy.ts';
import styles from './JsonPanel.module.css';

const TOKEN = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;

/** Splits pretty-printed JSON into spans for quiet syntax colouring, without injecting HTML. */
function tokenize(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of json.matchAll(TOKEN)) {
    const token = match[0];
    const at = match.index;
    if (at > last) out.push(json.slice(last, at));
    let kind = 'literal';
    if (token.startsWith('"')) kind = /^\s*:/.test(json.slice(at + token.length)) ? 'key' : 'string';
    else if (/^-?\d/.test(token)) kind = 'number';
    out.push(
      <span key={at} className={styles[kind]}>
        {token}
      </span>,
    );
    last = at + token.length;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

export function JsonPanel({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const id = useId();

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the JSON is still on screen and selectable.
    }
  };

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>
          {copy.result.json}
        </h2>
        <div className={styles.tools}>
          {open && (
            <button type="button" className={styles.tool} onClick={() => void copyText()}>
              {copied ? copy.json.copied : copy.json.copy}
            </button>
          )}
          <button
            type="button"
            className={styles.tool}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`${id}-code`}
          >
            {open ? copy.json.hide : copy.json.show}
          </button>
        </div>
      </div>
      {open && (
        <pre id={`${id}-code`} className={styles.code} tabIndex={0}>
          <code>{tokenize(text)}</code>
        </pre>
      )}
    </section>
  );
}
