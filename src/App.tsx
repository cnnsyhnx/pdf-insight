import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyze, ApiError } from './api/analyze.ts';
import styles from './App.module.css';
import { DocumentPane, type Active } from './components/DocumentPane.tsx';
import { DropSheet } from './components/DropSheet.tsx';
import { EvidenceCrop } from './components/EvidenceCrop.tsx';
import { Intro } from './components/Intro.tsx';
import { ProblemPanel } from './components/ProblemPanel.tsx';
import { Progress } from './components/Progress.tsx';
import { Result } from './components/Result.tsx';
import { Splash } from './components/Splash.tsx';
import { TopBar } from './components/TopBar.tsx';
import { copy, type Problem } from './copy.ts';
import { isDemo, loadDemo } from './dev/demo.ts';
import { useReducedMotion, useWide } from './hooks.ts';
import {
  buildAnalysis,
  fromExportJson,
  toExportJson,
  type Analysis,
  type AnalysisResponse,
} from './lib/analysis.ts';
import type { AnalyzeRequest } from './lib/contract.ts';
import { downloadJson, jsonFileName } from './lib/download.ts';
import { countLabel } from './lib/format.ts';
import { loadHistory, removeFromHistory, saveToHistory, type HistoryEntry } from './lib/history.ts';
import { checkFile, pageToText, PdfReadError, readPdf, type PageText } from './lib/pdf.ts';
import { planReveal } from './lib/reveal.ts';
import { shouldPlaySplash } from './lib/splash.ts';
import { haptic, isSoundOn, playStroke, setSoundOn } from './lib/sound.ts';
import { collectStrokes } from './lib/strokes.ts';

type Analyzer = (request: AnalyzeRequest, signal: AbortSignal) => Promise<AnalysisResponse>;

interface Loaded {
  doc: PDFDocumentProxy;
  pages: PageText[];
  total: number;
  chars: number;
}

/** Page numbers of the scans among the pages read so far. */
const scannedOf = (loaded: Loaded | null): number[] =>
  loaded ? loaded.pages.filter((p) => p.scan).map((p) => p.number) : [];

type Phase =
  | { kind: 'empty' }
  | { kind: 'reading'; file: File; loaded: Loaded | null }
  | { kind: 'analyzing'; file: File; loaded: Loaded; startedAt: number }
  | {
      kind: 'done';
      file: File | null;
      loaded: Loaded | null;
      analysis: Analysis;
      fresh: boolean;
      fromHistory: boolean;
    }
  | { kind: 'error'; file: File | null; loaded: Loaded | null; problem: Problem; pages: number | null };

export function App() {
  const wide = useWide();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ kind: 'empty' });
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [dragging, setDragging] = useState(false);
  const [soundOn, setSoundState] = useState(isSoundOn);
  const [splash, setSplash] = useState(shouldPlaySplash);
  const [active, setActive] = useState<Active | null>(null);
  const [tab, setTab] = useState<'result' | 'document'>('result');
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef<{ controller: AbortController; file: File; analyzer: Analyzer } | null>(null);

  /** The whole pipeline for one file: check, read, analyse, verify every quote against the PDF, remember. */
  const start = useCallback(async (file: File, analyzer: Analyzer = analyze) => {
    runRef.current?.controller.abort();
    const controller = new AbortController();
    runRef.current = { controller, file, analyzer };
    setActive(null);
    setTab('result');
    setPhase({ kind: 'reading', file, loaded: null });

    let latest: Loaded | null = null;
    try {
      await checkFile(file);
      const pages: PageText[] = [];
      const pdf = await readPdf(await file.arrayBuffer(), ({ doc, page, total }) => {
        pages.push(page);
        latest = { doc, pages: [...pages], total, chars: 0 };
        if (!controller.signal.aborted) setPhase({ kind: 'reading', file, loaded: latest });
      });
      const loaded: Loaded = { doc: pdf.doc, pages: pdf.pages, total: pdf.pages.length, chars: pdf.chars };
      latest = loaded;
      if (controller.signal.aborted) return;
      setPhase({ kind: 'analyzing', file, loaded, startedAt: Date.now() });

      const response = await analyzer(
        { fileName: file.name.slice(0, 255), pages: pdf.pages.map(pageToText) },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      // The file name and page count are facts the app already knows; they never come from the model.
      const known: AnalysisResponse = {
        ...response,
        insight: {
          ...response.insight,
          document: { ...response.insight.document, fileName: file.name, pages: loaded.total },
        },
      };
      const analysis = buildAnalysis(known, loaded.pages, new Date());
      setHistory(saveToHistory(toExportJson(analysis), loaded.total));
      setPhase({ kind: 'done', file, loaded, analysis, fresh: true, fromHistory: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      const problem: Problem =
        error instanceof PdfReadError || error instanceof ApiError ? error.problem : 'unknown';
      const pages = error instanceof PdfReadError ? error.pages : null;
      setPhase({ kind: 'error', file, loaded: latest, problem, pages });
    }
  }, []);

  const pick = useCallback(() => inputRef.current?.click(), []);
  const retry = useCallback(() => {
    const last = runRef.current;
    if (last) void start(last.file, last.analyzer);
  }, [start]);

  // Drop anywhere in the window. Counting enter/leave keeps the state steady while crossing child elements.
  useEffect(() => {
    let depth = 0;
    const hasFile = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const enter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) void start(file);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [start]);

  useEffect(() => {
    if (!isDemo()) return;
    void loadDemo().then(({ file, answer }) => start(file, () => answer()));
  }, [start]);

  const analysis = phase.kind === 'done' ? phase.analysis : null;
  const strokes = useMemo(() => (analysis ? collectStrokes(analysis) : null), [analysis]);
  const exportJson = useMemo(() => (analysis ? toExportJson(analysis) : null), [analysis]);
  const beats = useMemo(() => {
    if (phase.kind !== 'done' || !phase.fresh || reduced) return null;
    return planReveal(phase.analysis.summaryMarks.map((m) => m.end - m.start));
  }, [phase, reduced]);

  // The reveal: one felt-tip sound per highlight, in step with the strokes, a short tap at the end,
  // then the result settles so later re-renders never replay it.
  useEffect(() => {
    if (!beats) return;
    beats.forEach((beat) => playStroke(beat.duration, beat.delay));
    const last = beats.at(-1);
    const textEnd = last ? last.delay + last.duration : 0;
    const pageEnd = 650 + (strokes ? strokes.byKey.size : 0) * 110 + 520;
    const tap = setTimeout(() => haptic(10), textEnd);
    const settle = setTimeout(
      () => setPhase((p) => (p.kind === 'done' ? { ...p, fresh: false } : p)),
      Math.max(textEnd, pageEnd) + 200,
    );
    return () => {
      clearTimeout(tap);
      clearTimeout(settle);
    };
  }, [beats, strokes]);

  const onPickText = useCallback(
    (key: string) => {
      setActive((prev) =>
        !wide && prev?.key === key ? null : { key, nonce: (prev?.nonce ?? 0) + 1, from: 'text' },
      );
    },
    [wide],
  );

  const onPickPage = useCallback(
    (key: string) => {
      setActive((prev) => ({ key, nonce: (prev?.nonce ?? 0) + 1, from: 'page' }));
      if (!wide) setTab('result');
    },
    [wide],
  );

  useEffect(() => {
    if (active?.from !== 'page') return;
    document.getElementById(`mark-${active.key}`)?.scrollIntoView({
      block: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [active, reduced]);

  const download = useCallback(() => {
    if (exportJson) downloadJson(exportJson, jsonFileName(exportJson.document.fileName));
  }, [exportJson]);

  const toggleSound = () => {
    setSoundOn(!soundOn);
    setSoundState(!soundOn);
  };

  const openHistory = (entry: HistoryEntry) => {
    runRef.current?.controller.abort();
    setActive(null);
    setTab('result');
    setPhase({
      kind: 'done',
      file: null,
      loaded: null,
      analysis: fromExportJson(entry.result),
      fresh: false,
      fromHistory: true,
    });
  };

  const loaded = phase.kind === 'empty' ? null : phase.loaded;

  const renderCrop = (key: string): ReactNode => {
    if (wide || !loaded || !strokes) return null;
    const stroke = strokes.byKey.get(key);
    const page = stroke ? loaded.pages.find((p) => p.number === stroke.page) : undefined;
    if (!stroke || !page) return null;
    return (
      <EvidenceCrop
        doc={loaded.doc}
        page={page}
        total={loaded.total}
        stroke={stroke}
        onWholePage={() => {
          setTab('document');
          setActive((a) => (a ? { ...a, nonce: a.nonce + 1, from: 'text' } : a));
        }}
      />
    );
  };

  let left: ReactNode = null;
  switch (phase.kind) {
    case 'empty':
      left = (
        <Intro
          wide={wide}
          history={history}
          onPick={pick}
          onOpen={openHistory}
          onRemove={(id) => setHistory(removeFromHistory(id))}
        />
      );
      break;
    case 'reading':
      left = (
        <Progress
          fileName={phase.file.name}
          phase="reading"
          read={phase.loaded?.pages.length ?? 0}
          total={phase.loaded?.total ?? null}
          chars={0}
          startedAt={null}
          scanned={scannedOf(phase.loaded)}
        />
      );
      break;
    case 'analyzing':
      left = (
        <Progress
          fileName={phase.file.name}
          phase="analyzing"
          read={phase.loaded.total}
          total={phase.loaded.total}
          chars={phase.loaded.chars}
          startedAt={phase.startedAt}
          scanned={scannedOf(phase.loaded)}
        />
      );
      break;
    case 'done':
      left = exportJson && (
        <Result
          analysis={phase.analysis}
          exportJson={exportJson}
          pages={phase.analysis.insight.document.pages}
          wide={wide}
          fromHistory={phase.fromHistory}
          beats={beats}
          activeKey={active?.key ?? null}
          canPick={phase.loaded !== null}
          onPick={onPickText}
          renderCrop={renderCrop}
        />
      );
      break;
    case 'error':
      left = (
        <ProblemPanel
          problem={phase.problem}
          file={phase.file}
          pages={phase.pages}
          onRetry={retry}
          onPick={pick}
        />
      );
      break;
  }

  const right: ReactNode = loaded ? (
    <DocumentPane
      doc={loaded.doc}
      pages={loaded.pages}
      total={loaded.total}
      strokes={phase.kind === 'done' ? strokes : null}
      active={active}
      reveal={phase.kind === 'done' && phase.fresh && !reduced}
      onPick={onPickPage}
    />
  ) : (
    <DropSheet
      mode={
        phase.kind === 'reading'
          ? 'blank'
          : phase.kind === 'done' && phase.fromHistory
            ? 'note'
            : wide
              ? 'drop'
              : 'touch'
      }
      note={copy.intro.sheetHistory}
      dragging={dragging}
      onPick={pick}
    />
  );

  const fileName =
    phase.kind === 'empty' ? null : (phase.file?.name ?? analysis?.insight.document.fileName ?? null);
  const pageCount = loaded?.total ?? analysis?.insight.document.pages ?? null;
  const fileLabel = fileName
    ? `${fileName}${pageCount ? ` · ${countLabel(pageCount, 'strona', 'strony', 'stron')}` : ''}`
    : null;

  const showTabs = !wide && loaded !== null;
  const showLeft = wide || !showTabs || tab === 'result';
  // On phones the desk with the sheet sits under the intro, so the screen's lower half is not left empty.
  const deskBelow = !wide && phase.kind === 'empty';
  const showRight = wide || (showTabs && tab === 'document') || deskBelow;

  return (
    <div className={styles.app}>
      <TopBar
        file={fileLabel}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onNewFile={phase.kind === 'empty' ? null : pick}
        onDownload={exportJson ? download : null}
      />

      {showTabs && (
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'result'}
            className={styles.tab}
            onClick={() => setTab('result')}
          >
            {copy.document.tabResult}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'document'}
            className={styles.tab}
            onClick={() => setTab('document')}
          >
            {copy.document.tabDocument}
            <span className={styles.count}>{loaded.total}</span>
          </button>
        </div>
      )}

      <main className={styles.workspace}>
        <div className={styles.left} hidden={!showLeft}>
          <div className={styles.leftInner}>{left}</div>
        </div>
        {showRight && <div className={`${styles.right} ${deskBelow ? styles.below : ''}`}>{right}</div>}
      </main>

      {!wide && exportJson && tab === 'result' && (
        <div className={styles.bottomBar}>
          <button type="button" className={styles.download} onClick={download}>
            {copy.actions.download}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void start(file);
        }}
      />

      {splash && <Splash onDone={() => setSplash(false)} />}
    </div>
  );
}
