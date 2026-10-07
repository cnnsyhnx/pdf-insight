import type { ApiProblem } from './api/analyze.ts';
import { MAX_PAGES, MAX_TEXT_CHARS } from './lib/contract.ts';
import { countLabel, formatMegabytes, listLabel, plural } from './lib/format.ts';
import type { PdfProblem } from './lib/pdf.ts';

/** Every word the interface says, in one place, so the Polish can be read through in one sitting. */
export const copy = {
  intro: {
    title: 'Wgraj PDF. Zakreślę to, co w nim naprawdę jest.',
    lead: 'Dostaniesz krótkie podsumowanie i dane do pobrania w formacie JSON: kwoty, daty, organizacje i osoby. Każdą wartość sprawdzam w tekście dokumentu, zanim ją zakreślę.',
    pick: 'Wybierz plik PDF',
    dropHint: 'albo upuść go na kartkę obok',
    privacy:
      'PDF do 10 MB i 50 stron, z warstwą tekstową. Do analizy trafia tylko tekst pliku: wysyłam go do Anthropic, a jeśli nie odpowie, do OpenAI. Na serwerze nic nie zostaje. Ostatnie wyniki zapisuję tylko w tej przeglądarce.',
    rights: '© 2026 Can Seyhan (Jan). Wszelkie prawa zastrzeżone.',
    sheet: 'Upuść tu plik PDF',
    sheetDragging: 'Puść, a zacznę czytać',
    sheetLimit: 'do 10 MB i 50 stron',
    sheetTouch: 'Dotknij kartki, aby wybrać PDF',
    sheetHistory: 'Wgraj ten PDF ponownie, aby zobaczyć zakreślenia na stronach.',
    history: 'Ostatnie wyniki',
    remove: (title: string) => `Usuń z historii: ${title}`,
  },
  progress: {
    read: 'Czytam tekst',
    analyze: 'Analizuję treść',
    verify: 'Sprawdzam cytaty',
    done: 'gotowe',
    now: 'teraz',
    later: 'potem',
    reading: (read: number, total: number) => `strona ${read} z ${total}`,
    readDone: (pages: number, chars: number) =>
      `${countLabel(pages, 'strona', 'strony', 'stron')} · ${new Intl.NumberFormat('pl-PL').format(chars)} ${plural(chars, 'znak', 'znaki', 'znaków')}`,
    seconds: (s: number) => `${s} s`,
    scanned: (pages: number[]) =>
      pages.length === 1
        ? `Strona ${pages[0]} to skan bez warstwy tekstowej, więc nie wysyłam jej do analizy.`
        : `Strony ${listLabel(pages)} to skany bez warstwy tekstowej, więc nie wysyłam ich do analizy.`,
  },
  result: {
    legendStart: 'Zakreślam tylko to, co jest w dokumencie słowo w słowo, np.',
    legendEndWide: 'Kliknij zakreślenie, a pokażę je na stronie.',
    legendEndNarrow: 'Dotknij zakreślenia, a pokażę je w dokumencie.',
    // The app speaks in the first person but never in the past tense, which in Polish would give it a gender.
    legendNone:
      'Żaden fragment podsumowania nie występuje w dokumencie słowo w słowo, więc tu nic nie zakreślam.',
    fromHistory:
      'Wynik z historii. PDF nie jest przechowywany, więc zakreślenia na stronach zobaczysz po ponownym wgraniu pliku.',
    scanned: (pages: number[]) =>
      pages.length === 1
        ? `Strona ${pages[0]} to skan bez warstwy tekstowej, więc jej treści nie ma w tym wyniku.`
        : `Strony ${listLabel(pages)} to skany bez warstwy tekstowej, więc ich treści nie ma w tym wyniku.`,
    summary: 'Podsumowanie',
    keyPoints: 'Najważniejsze',
    amounts: 'Kwoty',
    dates: 'Daty',
    parties: 'Organizacje i osoby',
    organizations: 'Organizacje',
    people: 'Osoby',
    keywords: 'Słowa kluczowe',
    json: 'JSON',
    none: 'Brak w dokumencie.',
    notFound: 'nie znaleziono w tekście',
    page: (n: number) => `s. ${n}`,
    showOnPage: (n: number, quote: string) => `Pokaż na stronie ${n}: ${quote}`,
    footer: (model: string, ms: number, pages: number) =>
      `Model ${model} · ${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(ms / 1000)} s · ${countLabel(pages, 'strona', 'strony', 'stron')}`,
  },
  json: {
    show: 'Pokaż JSON',
    hide: 'Ukryj JSON',
    copy: 'Kopiuj',
    copied: 'Skopiowano',
  },
  document: {
    tabResult: 'Wynik',
    tabDocument: 'Dokument',
    page: (n: number, total: number) => `Strona ${n} z ${total}`,
    strokeLabel: (n: number) => `Zakreślenie na stronie ${n}`,
    wholePage: 'Pokaż całą stronę',
  },
  actions: {
    newFile: 'Nowy plik',
    download: 'Pobierz JSON',
    retry: 'Spróbuj ponownie',
    other: 'Wybierz inny plik',
    soundOn: 'Wyłącz dźwięk',
    soundOff: 'Włącz dźwięk',
    sound: 'Dźwięk',
  },
} as const;

type Problem = PdfProblem | ApiProblem | 'unknown';

/** Error messages say what happened and what to do next; nothing vague. */
export function problemCopy(
  problem: Problem,
  file: File | null,
  pages: number | null = null,
): { title: string; detail: string; retry: boolean } {
  switch (problem) {
    case 'not-pdf':
      return {
        title: 'To nie jest plik PDF.',
        detail: 'Rozpoznaję pliki po zawartości, nie po rozszerzeniu. Wybierz dokument PDF.',
        retry: false,
      };
    case 'too-large':
      return {
        title: 'Plik jest za duży.',
        detail: file ? `Ten plik ma ${formatMegabytes(file.size)}. Limit to 10 MB.` : 'Limit to 10 MB.',
        retry: false,
      };
    case 'too-many-pages':
      return {
        title: 'Ten PDF ma za dużo stron.',
        detail: `${pages ? `Ten plik ma ${countLabel(pages, 'stronę', 'strony', 'stron')}. ` : ''}Limit to ${MAX_PAGES} stron. Podziel PDF na części i wgraj je po kolei.`,
        retry: false,
      };
    case 'too-long':
      return {
        title: 'Ten dokument ma za dużo tekstu na jedną analizę.',
        detail: `Limit to ${new Intl.NumberFormat('pl-PL').format(MAX_TEXT_CHARS)} znaków, czyli tyle, ile mieści ${MAX_PAGES} gęsto zapisanych stron. Podziel PDF na mniejsze części i wgraj je po kolei.`,
        retry: false,
      };
    case 'password':
      return {
        title: 'Ten PDF jest zabezpieczony hasłem.',
        detail: 'Zdejmij hasło i wgraj plik ponownie.',
        retry: false,
      };
    case 'damaged':
      return {
        title: 'Nie mogę otworzyć tego pliku.',
        detail: 'PDF wygląda na uszkodzony. Zapisz go ponownie albo wybierz inny.',
        retry: false,
      };
    case 'no-text':
      return {
        title: 'Ten PDF nie ma warstwy tekstowej.',
        detail: 'To prawdopodobnie skan, a ja czytam tylko tekst zapisany w pliku. Wybierz PDF z tekstem.',
        retry: false,
      };
    case 'network':
      return {
        title: 'Brak połączenia z serwerem analizy.',
        detail: 'Sprawdź połączenie z internetem i spróbuj ponownie.',
        retry: true,
      };
    case 'rate-limit':
      return {
        title: 'Za dużo analiz w ciągu minuty.',
        detail: 'Limit to 4 analizy na minutę. Odczekaj minutę i spróbuj ponownie.',
        retry: true,
      };
    case 'daily-limit':
      return {
        title: 'Dzisiejszy limit analiz w tym demo się wyczerpał.',
        detail: 'Limit odnawia się o północy UTC. Spróbuj jutro.',
        retry: false,
      };
    case 'invalid-response':
      return {
        title: 'Model zwrócił niepoprawne dane.',
        detail:
          'Odpowiedź dwa razy nie przeszła walidacji schematu, więc jej nie pokazuję. Spróbuj ponownie.',
        retry: true,
      };
    case 'upstream':
      return {
        title: 'Modele AI chwilowo nie odpowiadają.',
        detail: 'Nie odpowiedział ani Anthropic, ani zapasowy OpenAI. Spróbuj ponownie za kilka minut.',
        retry: true,
      };
    case 'server':
      return { title: 'Serwer analizy zwrócił błąd.', detail: 'Spróbuj ponownie za chwilę.', retry: true };
    case 'unknown':
      return {
        title: 'Nie udało się przeanalizować pliku.',
        detail: 'Spróbuj ponownie. Jeśli błąd się powtórzy, wybierz inny plik.',
        retry: true,
      };
  }
}

export type { Problem };
