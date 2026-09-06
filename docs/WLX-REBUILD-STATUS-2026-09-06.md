# WLX-Neuaufbau: erster geprüfter Arbeitsblock

## Umfang und Evidenz

Ausgangspunkt ist `main` mit Commit `55448c107965308bba87d8c3196c1502a2943fa9` und Tree `abc3304378fc099358e47226d0479368b380682a`. Der vorhandene Checkout wurde per `git fetch origin main` und Fast-forward-Prüfung abgeglichen. Der Arbeitsbaum war zuvor sauber. Es wurde keine zweite Anwendung angelegt.

Alle 21 Projektaufgaben einschließlich WLX-000 bis WLX-013, zwei Unteraufgaben und die zwölf strukturierten Release-Abhängigkeiten wurden gelesen. Maßgeblich ist das [Asana-Projekt](https://app.asana.com/1/1204855960563003/project/1217096669609420).

A = produktiv beobachtet, B = durch Code/Tests bestätigt, C = Verbesserung, D = noch nicht überprüfbar. Historische Asana-Befunde sind nicht automatisch aktuelle Produktionsfehler.

| Paket | Vorher | Änderung / Nachweis | Verbleibendes Gate |
|---|---|---|---|
| WLX-001 | B: 4 von 1560 Tests fehlgeschlagen | Feste Berichtsfenster trafen auf `new Date()`-abhängige Leads außerhalb des Fensters. Uhrzeit auf 2026-09-04 fixiert; sämtliche fachlichen Assertions erhalten. Keine Änderung an der Entscheidungsmaschine. | Unabhängiger Review, Produktions-Datenparität |
| WLX-002 | B: nanoid 3.3.16 mit Produktions-Auditbefund | nanoid 3.3.18 in Override und Lockfile. Zusätzlich Entwicklungsabhängigkeiten brace-expansion 5.0.9 und js-yaml 4.3.1 gehärtet. | Immutable Release und Provider-Read-back |
| WLX-003 | B: veraltete Releaseaussage, fehlende Routes/Crons, Sync als Statuscheck beschrieben | README trennt historische Fingerprints, Health und schreibenden Sync; dokumentiert Sources, Deals, Reconciliation und alle sieben UTC-Cronpläne. Zwei zunächst fehlschlagende Dokumentationsverträge ergänzt. | Deployment-/Migrationstand unabhängig verifizieren |
| WLX-011 / Login | A: englischer Schalter ausgewählt, Logintexte bleiben deutsch | B: TreeWalker konnte an einem verschachtelten ausgeschlossenen Teilbaum abbrechen. FILTER_REJECT setzt den Lauf bei folgenden Vorfahren-Geschwistern fort; MutationObserver respektiert geschützte Vorfahren. React-eigene Loginübersetzung verhindert vorzeitige DOM-Änderungen während Hydrierung. Drei DOM-/Hydrierungsregressionen. | Authentifizierte übrige Seiten, komplette Zustands-/Rollen-/Accessibility-Matrix |

## Architektur und Grenzen

Die bestehende Next-App, serverseitige Authentifizierung, Scopes, Integrationen und Entscheidungsmaschine bleiben Grundlage. `TranslatedText` rendert die Logintexte aus dem Sprachkontext direkt mit React. Der Loginbereich ist vom nachträglichen DOM-Übersetzer ausgenommen; Markenbezeichnungen bleiben unverändert. Der gemeinsame Übersetzer überspringt geschützte Teilbäume, ohne den restlichen Traversierungslauf abzubrechen.

Der Browsernachweis umfasst DE→EN, Reload mit EN und EN→DE. Im lokalen Produktionsbuild wurde der zunächst beobachtete React-Hydrierungsfehler behoben; der abschließende neue Browser-Tab meldete keine Warnungen/Fehler. Login-Layoutbreiten 390, 768 und 1440 wurden ohne horizontale Überbreite geprüft. Dies ist keine vollständige Abnahme aller 14 Bereiche, kein erfolgreicher Login, kein Rollenmatrix-Nachweis und keine 200-%-Zoom- oder Screenreaderabnahme. Der gemeinsame Übersetzungspfad muss auf geschützten Seiten vor einem Release noch geprüft werden.

## Tatsächlich ausgeführte Produktionsprüfungen

- A: `GET /api/health` → HTTP 200, `ok=true`, `dataSource=warm`.
- A: Ohne Sitzung führt die Root-Seite zum Login. Der EN-Schalter auf dem ursprünglichen Produktionsstand übersetzt die Logintexte nicht.
- D: Supabase-OpenAPI-Read-back mit vorhandener lokaler Konfiguration → HTTP 401. Kein Schema-/Migrations-/Policy- oder Datenqualitätsnachweis möglich.
- D: Vercel CLI besitzt hier keinen nutzbaren Authentifizierungsstand. Deployment `dpl_9STwGFdhpN3rRuL5efJqtB52oacG` stammt aus der gelesenen Asana-Bestandsaufnahme, nicht aus einem neuen Provider-Read-back.
- D: Externer Hermes-Journaljob und dessen Pausenstatus sind auf diesem Mac nicht verifiziert.

Keine produktiven Daten, Migrationen, Backfills, Source-Regeln, Kampagnen, Rollen, Deals oder Pushkonfigurationen wurden verändert. Kein neuer Produktionsdeploy und keine unabhängige Releasefreigabe werden behauptet.

## Prüfumgebung und Nachweise

Lokaler Node-Stand: 25.6.1; npm 11.9.0. Der dokumentierte Vercel-Node-24-Stand wurde nicht neu providerseitig bestätigt. Lokale Tests ersetzen den Build auf der tatsächlichen Deploymentruntime nicht.

Die sanitisierten lokalen Prüfprotokolle liegen unter `artifacts/rebuild-2026-09-06/` (gitignored): Baseline, zunächst rote Regressionen, saubere Installation, vollständige Tests, Lint, Typecheck, Build, Audit, Dependency-Graph und Diffprüfung. Endergebnisse werden im Commit-bezogenen Asana-Read-back dokumentiert.

## Nächste ausführbare Schritte

1. Supabase- und Vercel-Anmeldung abschließen/verifizieren; keine Secrets in Asana oder Chat hinterlegen.
2. Schema-/RPC-/Policy-/Index-/Backfillstand anhand des bestehenden Runbooks ausschließlich lesend prüfen.
3. Autorisierte bestehende Super-Admin-, eingeschränkte interne und Partner-Testidentitäten verwenden; Erstellung/Änderung nur mit dem ausdrücklich freigegebenen Scope.
4. Account Monitor/Affiliate Optimizer und anschließend die übrigen Bereiche mit aktuellen Daten prüfen. Die weiteren Neuaufbaupakete bleiben offen.
5. Externe Journalsteuerung, exakten Releasecommit und unabhängigen Review klären. Anschließend unveränderlichen Kandidaten auf Vercel prüfen und Alias/Commit/Health zurücklesen.
6. Erst nach konkreter Preview scopegebundene Freigaben für produktive Schreibtests einholen; Migrationen und Provideränderungen weiter getrennt behandeln.
