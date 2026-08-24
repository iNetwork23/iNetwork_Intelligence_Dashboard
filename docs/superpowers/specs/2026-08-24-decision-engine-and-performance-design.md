# Entscheidungs-Engine vereinheitlichen · Datenpfad beschleunigen

Stand: 2026-08-24 · Pakete 1+2 der Gesamtüberarbeitung (Audit vom 24.08.)

## Paket 1 — Eine Entscheidungsmaschine

### Problem

Zwei Engines urteilen mit widersprüchlichen Schwellen über dieselben Daten:

- URL-Ebene `recommendation()` (affiliate-optimizer.ts): AUSSCHALTEN ab 50 SOIs,
  SKALIEREN ab 20 SOIs + 3 First-Sales, Median-Vergleich als Punktschätzer.
- Source-Ebene `assessTraffic()` (source-breakdown.ts): Urteil ab 100 Klicks
  oder 20 SOIs, rein nach Profit-Vorzeichen, First-Sales ignoriert.

Zusätzlich ist die Trend-Logik in `analyzeAffiliateTraffic` tot: Alle Aufrufer
übergeben dreimal dasselbe Portfolio, die 7d/30d-Effizienzdifferenz ist immer 0,
`variant.trend` wird nie „fallend", die WEITERLAUFEN-Herabstufung hat nie
gefeuert. `page.tsx` zeigt das Feld an — es lautet praktisch immer
„neu/zu wenig Daten" oder „stabil" und ist damit Rauschen.

### Lösung

Neues Modul `src/lib/decision-engine.ts`. Beide Ebenen rufen dieselbe Funktion;
die Source-Ebene projiziert das Fünf-Aktionen-Urteil auf ihre drei Aktionen
(AUSSCHALTEN→ABSCHALTEN, SKALIEREN→SKALIEREN, Rest→BEOBACHTEN).

Geschäftsanker bleiben unverändert (Entscheidung des Betreibers steht aus,
Annahme dokumentiert): 50 SOIs für Abschaltreife, 20 SOIs + 3 First-Sales für
Skalierung, Median×0,5 als Unterperformance-Grenze, 100 Klicks ohne SOI als
toter Traffic.

Statistische Härtung: Ratenvergleiche nutzen Wilson-Intervalle statt
Punktschätzer. Ein Kill wegen Unterperformance verlangt, dass schon die
**obere** Intervallgrenze der First-Sale-Rate unter Median×0,5 liegt — kleine
Stichproben können nicht mehr durch Zufallsrauschen sterben. Die Anker
entsprechen dabei bewusst den Intervall-Eigenschaften: 0 von 50 First-Sales
heißt obere Grenze ≈ 7 %; 3 von 20 heißt untere Grenze > 0.

Benchmark je Ebene: URL-Ebene übergibt wie bisher den Affiliate-Median;
Source-Ebene übergibt neu die aggregierte First-Sale-Rate des Elternkontexts
(alle Quellen desselben Offers) — damit gilt der Unterperformance-Kill auch dort,
statt des bisherigen reinen Vorzeichen-Kills.

Regelsatz (Reihenfolge = Priorität):

| # | Bedingung | Urteil |
|---|---|---|
| K3 | clicks ≥ 100 und sois = 0 | AUSSCHALTEN (toter Traffic) |
| K1 | sois ≥ 50, firstSales = 0, profit < 0 | AUSSCHALTEN |
| K2 | sois ≥ 50, Benchmark > 0, WilsonObergrenze(fs/sois) < Benchmark×0,5, profit < 0 | AUSSCHALTEN |
| S1 | sois ≥ 20, firstSales ≥ 3, profit > 0 | SKALIEREN |
| W1 | firstSales > 0, profit ≥ 0 | WEITERLAUFEN |
| T1 | sois < 50 und Traffic vorhanden | WEITER TESTEN |
| B | sonst | BEOBACHTEN |

Bewusste Verhaltensänderungen auf Source-Ebene, beide konservativer:

1. Reif-negativ **mit** First-Sales ist kein automatischer Kill mehr, sondern
   BEOBACHTEN (Warnton) bzw. Kill nur noch über K2 mit Benchmark.
2. SKALIEREN verlangt jetzt auch dort 3 First-Sales, nicht mehr nur
   20 SOIs + positiven Profit.

Tote Trend-Logik: `analyzeAffiliateTraffic` verliert die Fenster-Pretense
(eine Portfolio-Signatur), `variant.trend`, `efficiency.days7` und die nie
feuernde Herabstufung entfallen; `page.tsx` zeigt das Feld nicht mehr.
Die echte Trendaussage bleibt `trendVerdict` (Vorfenster-Vergleich).

## Paket 2 — Datenpfad

1. **Wasserfall parallelisieren:** In `page.tsx` warten Quellen-Breakdown und
   Smartlink-Laden nacheinander, sind aber unabhängig. Beide starten künftig
   gemeinsam; erst danach wird gemeinsam gewartet.
2. **Vorfenster-Cache:** Das Trend-Vorfenster ist historisch und ändert sich
   nur mit dem stündlichen Sync. Eigener Cache-Schlüssel, revalidate 3600 statt
   der 60 s des Live-Portfolios.
3. **Jahresaktivität entkoppeln:** Der 12-Monats-Verlauf für den
   „Letzter Lead"-Status erhält einen eigenen Cache (revalidate 3600) getrennt
   vom 300-s-Cache der Zeitraumsauswertung.
4. **Portfolio-TTL 60 → 300 s:** Der Sync läuft stündlich; ein 60-s-TTL erzeugt
   nur Neurechnungen ohne neue Daten. Der manuelle Smartlink-Refresh (bypass)
   ist davon unberührt.

## Absicherung

Bestehende Suite bleibt grün, außer Tests, deren Zusicherungen die absichtlich
geänderten Source-Semantiken festschreiben — diese werden auf die neue,
dokumentierte Semantik umgeschrieben (gleiche Intention: Urteil zu Datenlage).
Neue Tests: Wilson-Funktionen, Regelmatrix der Engine, Parität URL/Source,
Benchmark-Härtung (kleine Stichprobe überlebt, große fällt).
