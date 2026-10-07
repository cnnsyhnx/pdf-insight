import { useId, type ReactNode } from 'react';
import { copy } from '../copy.ts';
import type { Analysis, ExportJson, Source } from '../lib/analysis.ts';
import { normalizeQuote } from '../lib/evidence.ts';
import { formatAmount, formatDate, languageName, NBSP, polishTypography, TYPE_LABEL } from '../lib/format.ts';
import type { Beat } from '../lib/reveal.ts';
import { JsonPanel } from './JsonPanel.tsx';
import { Mark } from './Mark.tsx';
import styles from './Result.module.css';

interface Props {
  analysis: Analysis;
  exportJson: ExportJson;
  pages: number;
  wide: boolean;
  fromHistory: boolean;
  /** Reveal beats for the summary highlights; null when nothing should animate. */
  beats: Beat[] | null;
  activeKey: string | null;
  /** False when there is no document to show (a result opened from history). */
  canPick: boolean;
  onPick: (key: string) => void;
  /** On phones: the piece of the page behind the active highlight, shown in place. */
  renderCrop: (key: string) => ReactNode;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Result(props: Props) {
  const { analysis, exportJson, pages, wide, fromHistory, beats, activeKey, canPick, onPick, renderCrop } =
    props;
  const { insight, summaryMarks, sources } = analysis;
  const doc = insight.document;
  const summary = polishTypography(insight.summary);
  const pick = (key: string) => (canPick ? () => onPick(key) : null);

  const meta = [TYPE_LABEL[doc.type], doc.date ? formatDate(doc.date) : null, languageName(doc.language)]
    .filter(Boolean)
    .join(' · ');

  const summaryParts: ReactNode[] = [];
  let at = 0;
  summaryMarks.forEach((mark, i) => {
    const key = `s${i}`;
    if (mark.start > at) summaryParts.push(summary.slice(at, mark.start));
    summaryParts.push(
      <Mark
        key={key}
        id={`mark-${key}`}
        label={copy.result.showOnPage(mark.source.found.page, mark.source.quote)}
        active={activeKey === key}
        beat={beats?.[i] ?? null}
        onPick={pick(key)}
      >
        {summary.slice(mark.start, mark.end)}
      </Mark>,
    );
    at = mark.end;
  });
  if (at < summary.length) summaryParts.push(summary.slice(at));

  const example = summaryMarks[0];
  const activeSummaryKey = activeKey?.startsWith('s') ? activeKey : null;

  return (
    <article className={styles.result}>
      {fromHistory && <p className={styles.note}>{polishTypography(copy.result.fromHistory)}</p>}
      {analysis.meta.scannedPages.length > 0 && (
        <p className={styles.note}>{polishTypography(copy.result.scanned(analysis.meta.scannedPages))}</p>
      )}
      <p className={styles.meta}>{meta}</p>
      <h1 className={styles.title}>{polishTypography(doc.title ?? doc.fileName)}</h1>

      {!fromHistory && (
        <p className={styles.legend}>
          {example ? (
            <>
              {polishTypography(copy.result.legendStart)}{' '}
              <Mark label={example.source.quote} active={false} beat={null} onPick={null}>
                {summary.slice(example.start, example.end)}
              </Mark>
              {/* An abbreviation's full stop also ends the sentence: "r." never becomes "r..". */}
              {summary.slice(example.start, example.end).endsWith('.') ? ' ' : '. '}
              {polishTypography(wide ? copy.result.legendEndWide : copy.result.legendEndNarrow)}
            </>
          ) : (
            polishTypography(copy.result.legendNone)
          )}
        </p>
      )}

      <Section title={copy.result.summary}>
        <p className={styles.summary}>{summaryParts}</p>
        {activeSummaryKey && renderCrop(activeSummaryKey)}
      </Section>

      <Section title={copy.result.keyPoints}>
        <ul className={styles.points}>
          {insight.keyPoints.map((point) => (
            <li key={point}>{polishTypography(point)}</li>
          ))}
        </ul>
      </Section>

      <Section title={copy.result.amounts}>
        {insight.amounts.length === 0 ? (
          <p className={styles.none}>{copy.result.none}</p>
        ) : (
          <ul className={styles.rows}>
            {insight.amounts.map((amount, i) => {
              const key = `a${i}`;
              return (
                <li key={key} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.value}>
                      {formatAmount(amount.value)}
                      <span className={styles.unit}>{`${NBSP}${amount.currency}`}</span>
                    </span>
                    <span className={styles.context}>{polishTypography(amount.context)}</span>
                  </div>
                  <Citation
                    itemKey={key}
                    source={sources.amounts[i] ?? null}
                    activeKey={activeKey}
                    onPick={pick(key)}
                  />
                  {activeKey === key && renderCrop(key)}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={copy.result.dates}>
        {insight.dates.length === 0 ? (
          <p className={styles.none}>{copy.result.none}</p>
        ) : (
          <ul className={styles.rows}>
            {insight.dates.map((date, i) => {
              const key = `d${i}`;
              return (
                <li key={key} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.value}>{formatDate(date.date)}</span>
                    <span className={styles.context}>{polishTypography(date.context)}</span>
                  </div>
                  <Citation
                    itemKey={key}
                    source={sources.dates[i] ?? null}
                    activeKey={activeKey}
                    onPick={pick(key)}
                  />
                  {activeKey === key && renderCrop(key)}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={copy.result.parties}>
        <div className={styles.parties}>
          <Names
            title={copy.result.organizations}
            names={insight.entities.organizations}
            sources={sources.organizations}
            prefix="o"
            activeKey={activeKey}
            pick={pick}
            renderCrop={renderCrop}
          />
          <Names
            title={copy.result.people}
            names={insight.entities.people}
            sources={sources.people}
            prefix="p"
            activeKey={activeKey}
            pick={pick}
            renderCrop={renderCrop}
          />
        </div>
      </Section>

      <Section title={copy.result.keywords}>
        {insight.keywords.length === 0 ? (
          <p className={styles.none}>{copy.result.none}</p>
        ) : (
          <p className={styles.keywords}>{insight.keywords.join(' · ')}</p>
        )}
      </Section>

      <JsonPanel value={exportJson} />

      <p className={styles.footer}>
        {copy.result.footer(analysis.meta.model, analysis.meta.durationMs, pages)}
      </p>
    </article>
  );
}

interface CitationProps {
  itemKey: string;
  source: Source | null;
  activeKey: string | null;
  onPick: (() => void) | null;
}

/** The words a value was taken from, underlined with the narrow edge of the nib, and their page. */
function Citation({ itemKey, source, activeKey, onPick }: CitationProps) {
  if (!source) return <p className={styles.missing}>{copy.result.notFound}</p>;
  return (
    <p className={styles.citation}>
      <span className={styles.quote}>
        „
        <Mark
          id={`mark-${itemKey}`}
          edge="narrow"
          label={copy.result.showOnPage(source.found.page, source.quote)}
          active={activeKey === itemKey}
          beat={null}
          onPick={onPick}
        >
          {polishTypography(source.quote)}
        </Mark>
        ”
      </span>
      <PageRef page={source.found.page} onPick={onPick} />
    </p>
  );
}

function PageRef({ page, onPick }: { page: number; onPick: (() => void) | null }) {
  if (!onPick) return <span className={styles.pageRef}>{copy.result.page(page)}</span>;
  return (
    <button type="button" className={styles.pageRef} onClick={onPick} tabIndex={-1}>
      {copy.result.page(page)}
    </button>
  );
}

interface NamesProps {
  title: string;
  names: string[];
  sources: (Source | null)[];
  prefix: 'o' | 'p';
  activeKey: string | null;
  pick: (key: string) => (() => void) | null;
  renderCrop: (key: string) => ReactNode;
}

function Names({ title, names, sources, prefix, activeKey, pick, renderCrop }: NamesProps) {
  return (
    <div className={styles.names}>
      <h3 className={styles.subTitle}>{title}</h3>
      {names.length === 0 ? (
        <p className={styles.none}>{copy.result.none}</p>
      ) : (
        <ul className={styles.nameList}>
          {names.map((name, i) => {
            const key = `${prefix}${i}`;
            const source = sources[i] ?? null;
            // Underline the name only when the name itself, letter for letter, is what was found in the PDF.
            const verbatim = source !== null && normalizeQuote(source.quote) === normalizeQuote(name);
            return (
              <li key={key} className={styles.name}>
                <span className={styles.nameText}>
                  {verbatim ? (
                    <Mark
                      id={`mark-${key}`}
                      edge="narrow"
                      label={copy.result.showOnPage(source.found.page, name)}
                      active={activeKey === key}
                      beat={null}
                      onPick={pick(key)}
                    >
                      {polishTypography(name)}
                    </Mark>
                  ) : (
                    polishTypography(name)
                  )}
                </span>
                {source ? (
                  <PageRef page={source.found.page} onPick={pick(key)} />
                ) : (
                  <span className={styles.missingSmall}>{copy.result.notFound}</span>
                )}
                {activeKey === key && renderCrop(key)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
