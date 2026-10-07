/*
 * Draws every image in docs/readme from the running app and the brand sources, so the README never shows an
 * interface that no longer exists. Run it after a visible change: `npm run readme:images`.
 *
 * Needs `npm run dev` on http://localhost:5173/pdf-insight/, a local Chrome (CHROME_PATH to override) and the dev
 * fixtures in public/demo/: sample.pdf and response.json, a saved answer of the real backend. The fixtures stay out
 * of the repo because the sample PDF is the recruiter's test file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gifenc from 'gifenc';
import pngjs from 'pngjs';
import puppeteer from 'puppeteer-core';
import { bandPath, MARK } from '../src/components/mark.ts';

// Both packages are CommonJS.
const { GIFEncoder, applyPalette, quantize } = gifenc;
const { PNG } = pngjs;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'readme');
const APP = process.env.README_APP_URL ?? 'http://localhost:5173/pdf-insight/';
const CHROME =
  process.env.CHROME_PATH ??
  {
    win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  }[process.platform] ??
  '/usr/bin/google-chrome';

const DESKTOP = { width: 1200, height: 800, isMobile: false, hasTouch: false };
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };
/** One GIF frame every 40 ms: 25 per second, enough for strokes drawn at the speed of a hand. */
const STEP_MS = 40;

/* Brand values come from the code, never from the eye. */
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const tokens = Object.fromEntries(
  [...read('src/styles/tokens.css').matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
);
const DARK_INK = /prefers-color-scheme: dark\)\s*\{\s*\.ink\s*\{\s*fill:\s*(#[0-9a-f]{6})/i.exec(
  read('public/favicon.svg'),
)?.[1];
if (!tokens.ink || !tokens.paper || !tokens.marker || !tokens['rule-strong'] || !DARK_INK) {
  throw new Error('Brand colours not found in src/styles/tokens.css or public/favicon.svg');
}
const FONT = fs
  .readFileSync(
    path.join(
      ROOT,
      'node_modules/@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2',
    ),
  )
  .toString('base64');

const page = (body) => `<!doctype html><html><head><style>
  @font-face { font-family: 'Libre Franklin'; font-weight: 100 900; src: url(data:font/woff2;base64,${FONT}) format('woff2'); }
  html, body { margin: 0; background: transparent; }
  #shot { display: inline-block; }
</style></head><body>${body}</body></html>`;

/** Renders a piece of HTML and saves the element #shot, transparent around it, at twice the CSS size. */
async function render(browser, html, out) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
  await tab.setContent(page(html), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const shot = await tab.$('#shot');
  await shot.screenshot({ path: path.join(OUT, out), omitBackground: true });
  await tab.close();
}

/**
 * The lockup of src/components/Logo.tsx scaled as one piece (mark 22, gap 9, name 16), with room around it so
 * neither the mark nor the descender of the "g" is ever cut. On dark pages the ink turns light, as in the favicon;
 * the second line stays dark, because text under a highlighter does.
 */
function logo(scheme) {
  const ink = scheme === 'dark' ? DARK_INK : tokens.ink;
  const [first, second] = MARK.lines;
  return `<div id="shot" style="padding: 0.32em 0.4em; font: 600 48px/1 'Libre Franklin'; color: ${ink}">
    <div style="display: inline-flex; align-items: center; gap: calc(9em / 16); letter-spacing: -0.012em">
      <svg viewBox="0 0 32 32" style="width: calc(22em / 16); height: calc(22em / 16); flex: none">
        <rect x="${first.x}" y="${first.y}" width="${first.width}" height="${MARK.lineHeight}" rx="1.5" fill="${ink}"/>
        <path d="${bandPath()}" fill="${tokens.marker}"/>
        <rect x="${second.x}" y="${second.y}" width="${second.width}" height="${MARK.lineHeight}" rx="1.5" fill="${tokens.ink}"/>
      </svg>
      <span style="white-space: nowrap">PDF Insight</span>
    </div>
  </div>`;
}

/** The app's primary button (Intro.module.css: 46 px high, 24 px sides, radius 6, 15 px at 560), inverted on dark. */
function demoButton(scheme) {
  const [background, color] = scheme === 'dark' ? [DARK_INK, tokens.ink] : [tokens.ink, tokens.paper];
  return `<div id="shot" style="padding: 1px">
    <div style="display: flex; align-items: center; height: 46px; padding: 0 24px; border-radius: 6px;
      background: ${background}; color: ${color}; font: 560 15px/1 'Libre Franklin'">Otwórz demo</div>
  </div>`;
}

/**
 * A screenshot shown at `width` CSS pixels inside a hairline, so a white screen never melts into a white page.
 * `padding` adds paper around a crop, the same on every side.
 */
function framed(png, width, padding = '0') {
  return `<div id="shot">${screenshot(png, width, padding)}</div>`;
}

function screenshot(png, width, padding = '0') {
  return `<img src="data:image/png;base64,${png.toString('base64')}"
    style="display: block; width: ${width}px; padding: ${padding}; background: ${tokens.paper};
      border: 1px solid ${tokens['rule-strong']}">`;
}

/**
 * One step of the flow: its number and name above the phone screen. The label is ink on light pages and light on
 * dark ones, so each step comes in both.
 */
function step(png, number, name, scheme) {
  const ink = scheme === 'dark' ? DARK_INK : tokens.ink;
  return `<div id="shot" style="font: 16px/1 'Libre Franklin'; color: ${ink}">
    <div style="display: flex; gap: 8px; align-items: baseline; padding: 0 1px 12px">
      <span style="font-weight: 400">${number}</span><span style="font-weight: 600">${name}</span>
    </div>
    ${screenshot(png, 210)}
  </div>`;
}

/** Opens the app in a fresh tab, waits out the opening animation and returns the tab. */
async function openApp(browser, view, scale, query = '', prepare = async () => undefined) {
  const tab = await browser.newPage();
  await prepare(tab);
  await tab.setViewport({ ...view, deviceScaleFactor: scale });
  await tab.goto(`${APP}${query}`, { waitUntil: 'networkidle0' });
  await tab.keyboard.press('Shift'); // any key skips the splash
  await tab.waitForFunction(() => !document.querySelector('[data-splash]'), { timeout: 10_000 });
  return tab;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const resultShown = () => document.querySelector('article h2')?.textContent === 'Podsumowanie';
const analysing = () => document.querySelector('li[data-state="now"]')?.textContent?.includes('Analizuję');

/**
 * The nearest pixel row to `from`, moving by `step`, with no dark pixel between x0 and x1: cutting the image there
 * never slices a line of text in half.
 */
function quietRow(image, from, step, x0, x1, limit) {
  for (let y = Math.round(from), n = 0; n < limit && y > 0 && y < image.height; y += step, n++) {
    let quiet = true;
    for (let x = Math.round(x0); x < Math.round(x1) && quiet; x++) {
      const i = (y * image.width + x) * 4;
      if (image.data[i] + image.data[i + 1] + image.data[i + 2] < 3 * 175) quiet = false;
    }
    if (quiet) return y;
  }
  throw new Error(`No clean row near ${from}`);
}

/** The part of `image` between the given rows and columns (end exclusive). */
function crop(image, { top = 0, bottom = image.height, left = 0, right = image.width }) {
  const out = new PNG({ width: right - left, height: bottom - top });
  for (let y = top; y < bottom; y++) {
    image.data.copy(
      out.data,
      (y - top) * out.width * 4,
      (y * image.width + left) * 4,
      (y * image.width + right) * 4,
    );
  }
  return out;
}

/** The four steps on a phone: start, the wait, the result, and the proof on the page. */
async function phoneSteps(browser) {
  const shots = [];
  let tab = await openApp(browser, PHONE, 3);
  shots.push(await tab.screenshot());
  await tab.close();

  tab = await openApp(browser, PHONE, 3, '?demo&delay=60000');
  await tab.waitForFunction(analysing, { timeout: 20_000 });
  await sleep(1700); // the first card half typed
  shots.push(await tab.screenshot());
  await tab.close();

  tab = await openApp(browser, PHONE, 3, '?demo&delay=400');
  await tab.waitForFunction(resultShown, { timeout: 20_000 });
  await sleep(5000); // every highlight drawn
  shots.push(await tab.screenshot());
  const [, documentTab] = await tab.$$('[role="tab"]');
  await documentTab.click();
  await sleep(1500);
  shots.push(await tab.screenshot());
  await tab.close();

  const names = ['Start', 'Analiza', 'Wynik', 'Dowód'];
  for (const [i, png] of shots.entries()) {
    for (const scheme of ['light', 'dark']) {
      await render(browser, step(png, i + 1, names[i], scheme), `step-${i + 1}-${scheme}.png`);
    }
  }
}

/** The first amount, opened on its page: the paragraph on page 4 with its highlight, cut between lines. */
async function amountOnPage(browser) {
  const scale = 2;
  const tab = await openApp(browser, DESKTOP, scale, '?demo&delay=400');
  await tab.waitForFunction(resultShown, { timeout: 20_000 });
  await sleep(5000);
  await tab.click('#mark-a0');
  await tab.waitForSelector('path[class*="redraw"]', { timeout: 10_000 });
  await sleep(900); // scrolled into view and redrawn
  // The amount breaks across two lines, so the crop takes every stroke of it.
  const box = await tab.$$eval('path[class*="redraw"]', (strokes) => {
    const rects = strokes.map((stroke) => stroke.getBoundingClientRect());
    const paper = strokes[0]?.closest('figure')?.querySelector('div')?.getBoundingClientRect();
    if (!paper) throw new Error('No page around the highlight');
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { x: paper.left + paper.width * 0.08, width: paper.width * 0.84, top, bottom };
  });
  const margin = 130;
  const clip = { x: box.x, y: box.top - margin, width: box.width, height: box.bottom - box.top + 2 * margin };
  // Capturing beyond the viewport would resize the page and scroll the document pane back to page 1.
  const shot = PNG.sync.read(await tab.screenshot({ clip, captureBeyondViewport: false }));
  await tab.close();

  // Exactly the section heading and the two paragraphs after it, line by line, so no line is ever cut; the room
  // around them is paper added inside the frame, the same on every side.
  const lines = inkBands(shot);
  const first = lines.findIndex((line) => line.end >= margin * scale);
  const heading = lines[first - 1];
  const last = lines[first + 4]; // paragraph 1 has three lines, paragraph 2 two
  if (!heading || !last) throw new Error('Page 4 does not have the expected lines around the amount');
  const text = crop(shot, { top: heading.start, bottom: last.end + 1 });
  const columns = inkBands(transpose(text));
  const tight = crop(text, { left: columns[0].start, right: columns.at(-1).end + 1 });
  const png = PNG.sync.write(tight);
  await render(browser, framed(png, Math.round(tight.width / scale), '16px'), 'amount-page-4.png');
}

/** The image turned on its side, so columns can be scanned like rows. */
function transpose(image) {
  const out = new PNG({ width: image.height, height: image.width });
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      image.data.copy(
        out.data,
        (x * out.width + y) * 4,
        (y * image.width + x) * 4,
        (y * image.width + x) * 4 + 4,
      );
    }
  }
  return out;
}

const blankRow = (image, y) => {
  for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    if (Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) < 245) return false;
  }
  return true;
};

/** Runs of rows with anything drawn on them: the lines of text, top to bottom. */
function inkBands(image) {
  const bands = [];
  for (let y = 0; y < image.height; y++) {
    if (blankRow(image, y)) continue;
    const previous = bands.at(-1);
    if (previous && previous.end === y - 1) previous.end = y;
    else bands.push({ start: y, end: y });
  }
  return bands;
}

/**
 * The result arriving on a desktop. The strokes are CSS animations: they are paused and stepped through every
 * 40 ms, so each frame shows the page exactly as it looks at that moment of the real reveal.
 */
async function revealGif(browser) {
  const scale = 1.5;
  // The result drops its reveal animations on a timer a few seconds in. In this tab only, timers longer than two
  // seconds wait ten more minutes, which leaves time to step through the strokes.
  const holdLongTimers = (tab) =>
    tab.evaluateOnNewDocument(() => {
      const setTimer = window.setTimeout.bind(window);
      window.setTimeout = (handler, delay = 0, ...args) =>
        setTimer(handler, delay > 2000 ? delay + 600_000 : delay, ...args);
    });
  const tab = await openApp(browser, DESKTOP, scale, '?demo&delay=1000', holdLongTimers);
  await tab.waitForFunction(resultShown, { timeout: 20_000, polling: 'mutation' });
  const end = await tab.evaluate(() => {
    const strokes = document.getAnimations().filter((a) => /swipe|draw/.test(a.animationName ?? ''));
    for (const stroke of strokes) stroke.pause();
    window.readmeStrokes = strokes;
    return Math.max(...strokes.map((stroke) => Number(stroke.effect?.getComputedTiming().endTime ?? 0)));
  });
  const frames = [];
  for (let t = 0; t <= end + STEP_MS; t += STEP_MS) {
    await tab.evaluate(async (time) => {
      for (const stroke of window.readmeStrokes) stroke.currentTime = time;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, t);
    frames.push(PNG.sync.read(await tab.screenshot({ captureBeyondViewport: false })));
  }
  await tab.close();

  // End the picture in a gap between lines of both the summary and the page, not through them.
  const last = frames.at(-1);
  const across = (x1) => quietRow(last, last.height - 2, -1, 60 * scale, x1 * scale, 140 * scale);
  let bottom;
  try {
    bottom = across(1150);
  } catch {
    bottom = across(540); // no gap shared with the page: at least the summary is not cut through
  }
  const cropped = frames.map((frame) => crop(frame, { bottom }));
  fs.writeFileSync(path.join(OUT, 'reveal.gif'), encodeGif(cropped));
}

/** Indexed GIF with one palette for all frames; pixels that did not change are left transparent, which is small. */
function encodeGif(images) {
  const { width, height } = images[0];
  const rule = hex(tokens['rule-strong']);
  for (const image of images) hairline(image.data, width, height, rule);

  const first = images[0];
  const last = images.at(-1);
  const palette = quantize(Buffer.concat([first.data, last.data]), 255);
  const clear = palette.length;
  palette.push([0, 0, 0]);
  const indexed = images.map((image) => applyPalette(image.data, palette));

  // The loop opens on the finished result, so a paused GIF still shows every highlight; then the empty start,
  // the strokes as they are drawn, and the finished result held.
  const plan = [
    { index: indexed.length - 1, delay: 1400 },
    { index: 0, delay: 500 },
    ...indexed.slice(1).map((_, i) => ({ index: i + 1, delay: STEP_MS })),
  ];
  plan[plan.length - 1].delay = 1400;

  const gif = GIFEncoder();
  let previous = null;
  for (const { index, delay } of plan) {
    const pixels = indexed[index];
    if (!previous) {
      gif.writeFrame(pixels, width, height, { palette, delay, dispose: 1 });
    } else {
      const delta = Uint8Array.from(pixels, (value, i) => (value === previous[i] ? clear : value));
      gif.writeFrame(delta, width, height, { delay, transparent: true, transparentIndex: clear, dispose: 1 });
    }
    previous = pixels;
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

/** A 2-pixel frame in the rule colour, the same edge as the framed screenshots. */
function hairline(data, width, height, [r, g, b]) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue;
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}

// Start clean, so an image the README no longer uses never lingers in the repo.
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars'],
});
try {
  for (const scheme of ['light', 'dark']) {
    await render(browser, logo(scheme), `logo-${scheme}.png`);
    await render(browser, demoButton(scheme), `demo-${scheme}.png`);
  }
  await phoneSteps(browser);
  await amountOnPage(browser);
  await revealGif(browser);
} finally {
  await browser.close();
}
for (const file of fs.readdirSync(OUT)) {
  console.log(
    `${file.padEnd(22)} ${(fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0).padStart(6)} kB`,
  );
}
