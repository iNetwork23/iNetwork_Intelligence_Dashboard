# Affiliate Optimizer — Überarbeitung

Stand: 2026-08-23 · Branch: `claude/affiliate-optimizer-redesign`

## Ziel

Der Affiliate Optimizer (`/affiliates`) soll auf einen Blick beantworten, wo Geld
verloren geht, was skaliert gehört und was sich verändert hat. Jede Quelle und
jede Empfehlung muss sichtbar sein, ohne Klickerei und ohne abgeschnittene Listen.

## Ausgangslage

Vier belegte Mängel im heutigen Stand:

1. **Empfehlungen werden abgeschnitten.** `page.tsx:840` zeigt via `.slice(0, 4)`
   nur die ersten vier aus `stopVariants` und `scaleVariants` zusammen. Alle
   weiteren Empfehlungen sind in der Oberfläche nicht erreichbar.
2. **Quellen sind eingeklappt.** `SourceBreakdown.tsx:199` rendert jede
   Source-Gruppe in ein `LazyDetails`-Accordion. Sub-Sources werden erst nach
   Klick geladen und angezeigt; höchstens 20 Accordions bleiben gleichzeitig offen
   (`page.tsx:234`).
3. **Keine Kennzahl-Hierarchie.** Profit, SOIs, CVR, Klicks, Payout und
   Rebills werden optisch gleichrangig ausgegeben.
4. **Die Route ist ein Monolith.** `page.tsx` umfasst 1242 Zeilen mit
   Partner-Hero, Profit-Command, Next-Actions, zwei Lead-Latenz-Panels,
   Offer-Picker, Offer-Workspace und Affiliate-Liste in einer Datei.

Zusätzlich befundet: **Trenddaten existieren nicht.**
`affiliate-optimizer-service.ts` ruft `analyzeAffiliateTraffic(selected, selected, selected)`
mit dreimal demselben Zeitraum auf und stempelt jede Variante mit
`trend: 'neu/zu wenig Daten'`. Analog nutzt `getAffiliateSourceBreakdown`
`mergeSourceWindows(selected, selected, selected)`. Die Drei-Fenster-Mechanik ist
verkabelt, aber nie mit unterschiedlichen Zeiträumen befüllt. `reportWindow` in
`SourceBreakdown.tsx:90` ist fest auf `"days30"` gesetzt, es gibt also keinen
irreführenden Umschalter in der Oberfläche — nur ungenutzte Komplexität.

## Nicht im Umfang

- **Keine partnerübergreifende Quellentabelle.** Source-Daten werden pro Affiliate
  über `getAffiliateSourceBreakdown(affiliateId, …)` geladen und sind teuer. Über
  alle Partner gleichzeitig wäre die Seite unbrauchbar langsam. Vollständige
  Quellensicht wird innerhalb eines Partners gelöst, nicht global.
- **Keine Änderung an der Schreiblogik.** Source-Sperren
  (`SourceBlockButton`, `/api/source-blocks`) und Campaign-Status
  (`CampaignStatusButton`) bleiben unangetastet.
- **Kein Refactoring ohne Bezug zum Umbau.**
- E-Mail-Darstellung jeder Art. Ursprünglich angefragt, vom Auftraggeber
  zurückgezogen. Zur Aktenlage: ein DB-Trigger aus
  `20260731080000_harden_conversion_customer_identity.sql` entfernt `email` und
  `adv4` bei jedem Insert/Update aus `conversions.raw` und ersetzt die Identität
  durch einen SHA-256-Hash. Klartext-Adressen sind bewusst nicht verfügbar.

## Architektur

### Routing

`/affiliates` bekommt zwei Zustände:

| Aufruf | Ansicht |
|---|---|
| ohne `?affiliate=` | **Cockpit**, partnerübergreifend |
| mit `?affiliate=123` | **Partner-Workspace**, entrümpelter Drill-down |

Bestehende Deep-Links, die Rückkehr aus Smartlink Intelligence über `returnTo`
und die Offer-/URL-Anker (`#url-<offerUrlId>`) funktionieren unverändert. Der
heutige Zustand ohne Partner zeigt lediglich eine Namensliste; dieser tote
Zustand wird zum Cockpit.

### Zugriffsschutz

Das Cockpit ist eine Aggregatsicht und läuft nur hinter
`assertAffiliateOptimizerAggregateAccess`. Rollen ohne Aggregatrecht — insbesondere
`partner` — erreichen es nicht und werden direkt in den Workspace ihres eigenen
Scopes geführt. `foreignScopeRequested` bleibt für jede angeforderte Affiliate-ID
aktiv. Die bestehenden `finance.view`- und `smartlinks.view`-Prüfungen bleiben
unverändert bestehen.

## Datenschicht: Vergleichszeitraum

Neu: `getAffiliateOptimizationsWithTrend(period, custom, access)` in
`affiliate-optimizer-service.ts`.

Sie lädt über `getDashboard` zwei Fenster:

- das gewählte Fenster
- das unmittelbar davorliegende, **gleich lange** Fenster
  (30 Tage → die 30 Tage davor)

und rechnet je Variante die Differenz in Profit, SOIs und CVR. Das hartcodierte
`trend: 'neu/zu wenig Daten'` entfällt.

### Reifeschwelle für Trendaussagen

Ein Trend wird **nur** ausgewiesen, wenn beide Fenster die bestehenden Schwellen
aus `source-breakdown.ts` erfüllen: `MIN_DECISION_CLICKS = 100` oder
`MIN_SCALE_SOIS = 20`. Andernfalls steht in der Zelle explizit „zu wenig Daten"
statt einer Prozentzahl.

Das ist keine Vorsichtsgeste, sondern Hauslinie: Das README verbietet
ausdrücklich, Eventzahlen als kausale Umsatzzuordnung auszugeben, und
`assessTraffic` verweigert bereits heute ein Urteil unterhalb dieser Schwellen.
Eine Trendzahl aus dünner Datenlage wäre genau der Fehler, den das Projekt an
anderer Stelle konsequent vermeidet.

### Caching

Der Vergleichszeitraum wird über dieselbe `unstable_cache`-Mechanik wie das
Hauptfenster geführt, mit eigenem Schlüssel inklusive `scopeFingerprint(access)`.
Ein zusätzlich geladenes Fenster verdoppelt die Snapshot-Abfrage; beide Fenster
liegen als Portfolio-Range-Snapshot vor und werden nicht neu aus Everflow gezogen.

## Cockpit

Drei Listen, jede **vollständig** — `.slice(0, 4)` fällt ersatzlos weg.

| Liste | Sortierung | Zeileninhalt |
|---|---|---|
| Verluste | negativster Profit zuerst | Partner · Offer/URL · Verlust € · Begründung |
| Skalieren | größter Profit zuerst | Partner · Offer/URL · Profit € · SOIs |
| Veränderung | größter Delta-Betrag zuerst | Partner · Offer/URL · Δ € · Δ % vs. Vorperiode |

Die bestehende Zeitraumsteuerung (`AffiliatePeriodControls`,
`resolveAffiliatePeriod`) gilt auch für das Cockpit und bestimmt zugleich das
Vergleichsfenster der Veränderungsliste: gewählter Zeitraum gegen das unmittelbar
davorliegende, gleich lange Fenster. Bei `period=all` und `period=12m` entfällt
die Veränderungsliste mit Begründung, weil kein gleich langes Vorfenster in der
365-Tage-Historie liegt.

Je Liste:

- Zeilenzähler im Kopf („47 Positionen"), damit Vollständigkeit sichtbar ist
- Summenzeile: Gesamtverlust der Verlustliste, Gesamtprofit der Skalierungsliste
- sortierbare Spalten
- Klick auf eine Zeile führt in den Partner-Workspace, verankert auf die
  betreffende Offer-URL

Ist eine Liste leer, steht dort der Grund — „keine Position unterschreitet die
Reifeschwelle" ist etwas anderes als „keine Verluste".

## Partner-Workspace

### Quellentabelle

`SourceBreakdown` wird von Accordions auf **eine flache Tabelle** umgestellt:

- jede Source und jede Sub-Source als eigene Zeile
- Sub-Sources unter ihrer Source eingerückt
- standardmäßig sichtbar, kein Aufklappen nötig
- Spalten sortierbar
- Suchfeld bleibt (`SourceSearchField`, `rankNestedSourceMatches`)
- Sperr-Aktionen bleiben (`SourceBlockButton`)
- `LazyDetails` entfällt an dieser Stelle; der `sourceOpen`-Query-Parameter und
  sein 20er-Limit werden damit gegenstandslos und entfallen mit

Bei sehr vielen Quellen bleibt die Tabelle vollständig gerendert. Zeigt sich das
in der Praxis als zu langsam, ist Virtualisierung der nächste Schritt — nicht
Abschneiden.

### Kennzahl-Hierarchie

Groß und farbig gesetzt werden ausschließlich **Profit** und **Aktion**
(`SKALIEREN` / `ABSCHALTEN` / `BEOBACHTEN`). SOIs, CVR, Klicks, Payout, Rebills
und Coin-Spend werden sekundär gesetzt: lesbar, aber nicht gleichrangig. Die
Farbcodierung folgt der bestehenden `actionClass`-Logik
(`positive` / `critical` / `neutral`).

## Dateiaufteilung

`page.tsx` wird von 1242 Zeilen auf eine schlanke Route reduziert, die
Authentifizierung, Scope-Prüfung und die Weiche zwischen Cockpit und Workspace
enthält.

| Datei | Verantwortung |
|---|---|
| `page.tsx` | Route: Auth, Scope, Weiche |
| `AffiliateCockpit.tsx` | die drei Listen, partnerübergreifend |
| `TrendList.tsx` | eine Cockpit-Liste, generisch über Sortierung und Spalten |
| `PartnerWorkspace.tsx` | Drill-down eines Partners |
| `SourceTable.tsx` | flache Quellentabelle, ersetzt die Accordion-Sicht |

Die bestehenden Panels (`ProfitPeriod`, `UrlLeadMaturityPanel`,
`SourceCacheNotice`) wandern unverändert mit in die passende Datei.

## Absicherung

Abnahmebedingung ist, dass die 924 bestehenden Tests grün bleiben.

Neue Tests:

- **Trendberechnung:** korrekte Differenz bei ausreichender Datenlage; „zu wenig
  Daten" unterhalb beider Schwellen; kein Trend, wenn das Vorfenster leer ist
- **Vollständigkeit:** die Cockpit-Listen enthalten so viele Zeilen wie
  Empfehlungen vorliegen — ausdrücklich als Regressionstest gegen die
  Rückkehr eines `slice`
- **Zugriffsschutz:** Cockpit ohne Aggregatrecht nicht erreichbar; Partner-Rolle
  sieht keine fremden Affiliates
- **Quellentabelle:** alle Sources und Sub-Sources sind ohne Interaktion im
  Markup vorhanden

`optimization-workflow-ui.test.tsx` prüft, dass jede Optimizer-Seite
`OptimizationFlow` einbindet. Beide neuen Ansichten müssen das erfüllen.

## Offene Punkte

Keine. Bei der Umsetzung zu beachten: Die tatsächliche Zeilenzahl der
Quellentabelle in Produktion ist unbekannt, weil die Oberfläche hinter dem Login
liegt und nicht eingesehen wurde. Sollte sie in der Praxis vierstellig werden,
ist Virtualisierung nachzuziehen.
