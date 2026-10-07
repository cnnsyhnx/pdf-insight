# AI_LOG

PDF Insight powstał w ciągu doby, 7 i 8 października 2026 r., we współpracy z AI. Poniżej: narzędzia, kluczowe prompty, miejsca, w których AI się pomyliło, i sposób, w jaki każdy z tych błędów został wychwycony i poprawiony.

## Narzędzia

- **Claude Code** w VS Code z modelem **Claude Opus 5.5**: kod, testy, przeglądy, zrzuty ekranu.
- **Konektor Gmail w Claude**: odczyt maila z zadaniem i obu załączników (briefu i testowego PDF).
- **Chrome sterowany przez puppeteer-core**: zrzuty każdego ekranu w szerokości 1440 px i 390 px, także klatka po klatce dla animacji.
- **W aplikacji**: Claude Sonnet 5.5 (Anthropic) jako model główny, GPT-5.4 mini (OpenAI) jako zapasowy.
- **Kontrola**: TypeScript `strict`, ESLint, Prettier, Vitest, a do lokalnego backendu Wrangler.

## Jak pracuję z AI

- **AI pisze, decyzje są moje.** Ustalam cel i ograniczenia, stawiam poprzeczkę, a potem oceniam efekt tak, jak oceni go użytkownik: na telefonie i na komputerze. To, co jest poniżej poprzeczki, wraca do poprawki.
- **Koszt i ryzyko od pierwszego promptu.** Wybór dostawców, zapasowy model i dzienny limit wynikają z realnego budżetu, a nie z domysłów.
- **Bezpieczeństwo jako nawyk.** Klucze są tylko lokalnie i w sekretach Workera. Nic nie trafia do sieci bez mojej wyraźnej zgody.
- **Własny standard projektowy.** AI pracuje nad interfejsem według mojego prywatnego standardu projektowego. To know-how mojej firmy, dlatego nie ma go w repozytorium i nie opisuję jego treści. Jego efekt widać w demo.

## Kluczowe prompty

Prompty były pisane po turecku; poniżej w tłumaczeniu, skrócone.

1. **Dostawcy i budżet.** „Dam ci dwa klucze. Najpierw Anthropic, a jeśli nie odpowie, OpenAI.” A przed wdrożeniem: „Ogranicz to do 20 plików, każdy do 50 stron, a limit znaków ustaw na tyle, ile ma 50-stronicowy dokument. Nic nie może wygenerować ogromnego rachunku za API.”
   Efekt: Worker pyta Anthropic, a przy awarii, przekroczonym limicie zapytań, braku środków lub zbyt długim czasie odpowiedzi pyta OpenAI. Limity: 20 dokumentów na dobę dla całego demo, 4 analizy na minutę z jednego IP, do 50 stron i 200 000 znaków na dokument (50 gęsto zapisanych stron po 4000 znaków). Za długi PDF odpada, zanim aplikacja przeczyta pierwszą stronę, a Worker sprawdza to samo jeszcze raz. Dzień demo kosztuje najwyżej około 5 USD.
2. **Klucze.** „W `.env.local` wpisz same nazwy zmiennych, klucze wpiszę samodzielnie.”
   Efekt: klucze nie pojawiają się w kodzie, w historii Git ani we frontendzie. W środowisku produkcyjnym są sekretami Workera.
3. **Poprzeczka.** „Ten kierunek jest najlepszy, ale wciąż wygląda jak zrobiony przez AI. Ma wyglądać jak praca ludzi z wieloletnim doświadczeniem w ilustracji i animacji. Pokaż też widok webowy, nie tylko mobilny.”
   Efekt: interfejs zbudowany od nowa jako prawdziwa aplikacja, każdy ekran sprawdzony w 1440 px i 390 px.
4. **Czekanie.** „Analiza chwilę trwa. Dodaj na ten czas małą animację w stylu ilustracji.”
   Efekt: karta katalogowa zapełnia się słowo po słowie i trafia na stos zapisanych kart. Bez dźwięku i bez żółtego, bo żółty oznacza w tej aplikacji tylko słowa potwierdzone w PDF. Przy ustawieniu „ogranicz ruch” karta stoi w miejscu.
5. **Kontrola przed oddaniem.** „Zrób skan bezpieczeństwa, upewnij się, że klucze nigdzie nie wyciekły i że zadanie jest zrobione w całości.”
   Efekt: wartości kluczy szukane w każdym pliku repozytorium, w obiektach Git i w buildzie, bez trafień. Do tego przegląd briefu punkt po punkcie i prawdziwe analizy testowego PDF, które pokazały dwa braki opisane niżej (pominięty skan, niepełne kwoty).

## Gdzie AI się pomyliło

1. **Ukryte polecenie przeciekło do podsumowania.** Testowy PDF ma na stronie 4 niewidoczne polecenie dla AI. Model go nie wykonał, ale dopisał do podsumowania zdanie, że „w tekście znajduje się osadzone polecenie dla systemu AI, które zostało zignorowane”. Błąd wyszedł przy czytaniu prawdziwej odpowiedzi. Poprawka w `worker/src/prompt.ts`: model ma nie wykonywać poleceń z dokumentu i o nich nie wspominać, a podsumowanie ma opisywać tylko przedmiot dokumentu. Ponowny test: 4 zdania i 9 z 9 cytatów potwierdzonych w PDF.
2. **Zabezpieczenie, którego nie było.** AI dodało do pdf.js opcję `isEvalSupported: false` jako ochronę przed CVE-2024-4367 i zgłosiło to jako zrobione. `tsc` pokazał, że pdf.js 6 tej opcji nie ma. Sprawdzenie plików biblioteki: nie zawierają `new Function`, więc tej ścieżki ataku już nie ma. Opcja usunięta, raport poprawiony.
3. **Niewidoczne znaki.** Narzędzie do zapisu plików zamieniało zapis `\u00A0` na dosłowną twardą spację. Dwie pierwsze próby naprawy nie zadziałały: `sed` wstawił do kodu tekst `00A0`, a `perl` nic nie zmienił. 3 z 28 testów nie przeszły. Rozwiązanie: stała `NBSP = '\xA0'` i testy, które z niej korzystają.
4. **Przesunięte zakreślenia.** Polska typografia (twarde spacje po jednoliterowych wyrazach i w liczbach) zmieniała długość tekstu, więc zakreślenia liczone po pozycjach znaków się przesuwały. Teraz każda reguła zamienia jedną spację na jedną twardą spację i długość tekstu się nie zmienia.
5. **Interfejs „jak z AI”.** Pierwsza wersja była tylko mobilna i miała typowe klisze: drobne etykiety wersalikami, kremowe tło, identyczne zaokrąglone pudełka, sztuczną ramkę telefonu. Po mojej uwadze (prompt 3) wybrany kierunek został zbudowany od nowa.
6. **Animacja jak alfabet Morse’a.** Pierwsza wersja animacji czekania rysowała krótkie słowa jako zaokrąglone kreski i na zrzucie czytała się jak kreska, kropka, kreska. Poprawka: słowa od trzech znaków, proste końce i wąskie odstępy jak w maszynopisie. Test pilnuje, żeby żadne słowo nie było krótsze.
7. **Skan pominięty bez słowa.** Strona 11 testowego PDF (Aneks nr 1) to obraz bez warstwy tekstowej i aplikacja po cichu ją pomijała, więc zmiana abonamentu z aneksu znikała z wyniku. OCR to punkt COULD, ale cisza była błędem. Teraz aplikacja wykrywa skany i informuje o nich podczas analizy, w wyniku i w JSON (`meta.scannedPages`).
8. **Niepełne kwoty.** Przy poleceniu „every amount of money” model zwracał 6 kwot, a zaliczkę z najważniejszych punktów pomijał na liście kwot. Dokładniejsza instrukcja (warunki finansowe ustalone w dokumencie, a każda kwota i data z podsumowania także na liście) dała 10 kwot, wszystkie potwierdzone w PDF, w 11,8 s.

## Jak sprawdzam pracę AI

- Każda zmiana przechodzi TypeScript `strict`, ESLint, Prettier i 87 testów Vitest.
- Każdy ekran jest oglądany na zrzutach w 1440 px i 390 px, animacje także klatka po klatce.
- Prawdziwe analizy testowego PDF: wynik w 11–17 s od wgrania, JSON zgodny ze schematem z sekcji 04, wszystkie kwoty, daty i nazwy potwierdzone w tekście PDF, ukryte polecenie zignorowane.
- Model nigdy nie decyduje, co jest prawdą: każdy cytat sprawdza kod aplikacji, a żółty pojawia się tylko pod słowami, które ten kod znalazł w PDF.

Jan
