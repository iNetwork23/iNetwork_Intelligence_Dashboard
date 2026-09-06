# WLX-Neuaufbau: geprüfte Arbeitspakete und offene Produktionsgates

Stand: 2026-09-07 (Europe/Berlin), Provider- und Browserbelege vom 2026-09-06 UTC. Der Neuaufbau ist noch nicht abgeschlossen. Maßgeblich sind das [Asana-Projekt](https://app.asana.com/1/1204855960563003/project/1217096669609420) und [Draft-PR #4](https://github.com/iNetwork23/iNetwork_Intelligence_Dashboard/pull/4).

## Grundlage und Architektur

Kanonischer Checkout: `iNetwork23/iNetwork_Intelligence_Dashboard`, Arbeitsbranch `fix/wlx-release-gates-2026-09-06`. `origin/main` und das erneut aus Vercel gelesene Produktionsdeployment stehen auf `55448c107965308bba87d8c3196c1502a2943fa9` (Tree `abc3304378fc099358e47226d0479368b380682a`). Alle 21 Projektaufgaben einschließlich WLX-000 bis WLX-013, zwei Unteraufgaben und zwölf strukturierte Release-Abhängigkeiten wurden gelesen; betroffene Aufgaben wurden vor den Arbeitspaketen erneut abgeglichen. Hermes ist keine Voraussetzung für diesen Checkout; der externe Journaljob bleibt separat ungeprüft.

Die vorhandene Next-App mit serverseitiger Authentifizierung, Scopes, Supabase, Everflow, Entscheidungsmaschine und Vercel-Crons bleibt Grundlage. Es gibt keine zweite Produktionsanwendung. Zugewiesene interne Datenfreigaben werden nun von den gemeinsamen Lesehelfern vor Aggregation/Ausgabe angewendet. Ein versionierter Scope-Fingerprint verhindert die Wiederverwendung älterer unbeschränkter Cacheergebnisse. Partner ohne Scope erhalten weiterhin keine Daten, nicht auswertbare Scopes bleiben gesperrt.

A = produktiv beobachtet; B = durch Code, Tests oder Provider bestätigt; C = Vorschlag; D = noch ausstehend. Historische Befunde sind keine aktuellen Fehlernachweise.

## Implementierte Arbeitspakete

| Paket | Ausgangsbefund | Korrektur und Nachweis |
|---|---|---|
| WLX-001 | B: vier Tests nutzten zeitabhängige Leads außerhalb fester Berichtsfenster | Uhrzeit deterministisch fixiert, fachliche Assertions und Entscheidungsmaschine erhalten |
| WLX-002 | B: Produktionsbefund für nanoid | nanoid 3.3.18, Entwicklungsabhängigkeiten gehärtet; vollständiger Audit ohne Befunde |
| WLX-003 | B: veraltete Routes, Crons und Betriebsbeschreibung | README enthält alle sieben Cronpläne, trennt Health von schreibendem Sync, dokumentiert den tatsächlichen Hot-Sync und den separat freizugebenden Indexaufbau |
| WLX-011 / Login | A: EN ausgewählt, Login deutsch; B: Traversierungs-/Hydrierungsfehler | React-eigene Loginübersetzung und korrigierter TreeWalker; DE/EN, Reload und drei Breiten im bisherigen Preview geprüft |
| WLX-008 / Scopes | B: gemeinsame Lesehelfer ignorierten zugewiesene interne Scopes | Portfolio, Quellen, Smartlink-Aggregation, Rebill-Events und Kohorten eingeschränkt; Access-Vorschau erklärt das tatsächliche Verhalten; Regressionen zunächst rot |
| WLX-006 / LTV | B: HTTP-erfolgreiches RPC-Ergebnis `status: failed` wurde als `ready` gespeichert | Nur `status: refreshed` bestätigt Erfolg; tatsächlicher Refresh-Zeitstempel; unbekannte/fehlende Ergebnisse bleiben Fehler |
| WLX-006 / API | B: Kohorten-500 enthielt interne DB-Details | Generische Antwort, separate Finanz-/Scope-403-Grenzen; API-Regression zunächst rot |
| WLX-011 / Kohortenfilter | A: Subsource und Filterknopf bei 390 px abgeschnitten | Begrenzte Gridspalten, umbrechende Desktopzeile und passende Formularbreiten; alle fünf Kontrollen bei 390/768/1440 vollständig erreichbar, mindestens 44 px hoch; sichtbarer Tastaturfokus |

Die Layoutprüfung verwendet das tatsächliche Repository-CSS und die Kohortenformularstruktur in einer isolierten lokalen Browserseite mit ausdrücklich synthetischen Formulardaten. Sie ist kein Nachweis einer authentifizierten Kandidatenanwendung mit Datenanbindung.

## Neuer Produktions- und Provider-Read-back

- A: Benutzeranmeldung erfolgreich, sichtbare Sitzung `Super Admin`. Root, Affiliate Optimizer, Sources, Kohorten, Automation, Source-Blocks, Access-Konsole, App-Einstellungen und Deal-Register öffnen mit realen Daten bzw. ihrem tatsächlichen Konfigurationszustand. Smartlinks leitet zu Affiliates weiter.
- A: Kohorten-Partnerfilter bleibt in der URL erhalten und grenzt die sichtbare Ergebnismenge ein. Source-/Account-Seiten zeigen Partial-/Stale-Hinweise statt vollständige Daten zu behaupten.
- A/B: `/fraud` endet im Browserladefehler; Vercel meldet am 2026-09-06 um 21:51:33 UTC für diese Route einen wegen Speichermangels beendeten Prozess. Keine Behebung oder abgeschlossene Fraud-Abnahme behauptet. Der Code lädt Source-Snapshots vollständig in den Speicher; eine konkrete Spitzenlast-/Speicheranalyse steht aus.
- A: Die Legacy-Super-Admin-Sitzung erhält auf `/settings/security` den vorgesehenen 403 für diesen Sitzungstyp. Andere erlaubte/abgewiesene Rollen wurden noch nicht angemeldet geprüft.
- A: App-Seite zeigt kein registriertes Push-Gerät und fehlende OneSignal-Variablen. Deal-Register zeigt den dokumentierten Fallback auf Standardregeln. Keine Konfiguration verändert.
- A: EN enthält auf geschützten Seiten weiterhin deutsche dynamische Texte; ein inkonsistent formatiertes Geldlabel wurde beobachtet. Die gesamte DE/EN-Matrix ist offen.
- B: Supabase-MCP funktioniert. RLS, Grants, Tabellen, RPCs, Indizes, Identitätsconstraint und aggregierte Datenqualität sind gelesen. Interne Rollen verwenden aktuell Auth-Metadaten und `sync_state`; leere normalisierte Rollentabellen sind kein Loginfehler. Details und Index-Preview im [Datenbank-Read-back](WLX-DATABASE-READBACK-2026-09-06.md).
- B: History/Fraud bleiben im Backfill; LTV meldet Refresh-Timeout. Vercel enthält Source-/Conversion-Timeouts, Pagination-Unvollständigkeit und einen Metric-Replacement-Vertragsfehler. Die Ursache der ungültigen Metric-Zeile ist noch nicht reproduziert; der Vertrag bleibt strikt.
- B: Vercel-MCP bestätigt Produktionsdeployment `dpl_9STwGFdhpN3rRuL5efJqtB52oacG`, READY, Commit wie oben, Node 24. Das vorherige Preview `dpl_JAgDdxq3H9CAYDzLUUkQGnLw5Foj` bestätigt Commit `a4e065e5c068237f8e5181afc46f94101e6694f8`; seine Runtime meldet fehlende Supabase-Konfiguration. Eine reine READY-Meldung belegt keine Datenanbindung. Die Vercel-Oberfläche bestätigt alle 13 vorhandenen Variablen ausschließlich für Production; Secret-Werte wurden nicht aufgedeckt.

## Prüfstand und Grenzen

Der letzte vollständige Lauf umfasst 189 Testdateien und 1585 bestandene Tests. Lint, Typecheck, Produktionsbuild und vollständiger Dependency-Audit sind bestanden. Der abschließende Lauf nach der CSS-Korrektur bestätigt dieselben 1585 Tests, Lint, Typecheck und Produktionsbuild; `git diff --check` ist sauber und der vollständige Audit meldet 0 Schwachstellen. Commit/Tree/Deployment werden in Asana und im externen Prüfbericht verknüpft. Lokale Runtime: Node 25.6.1, npm 11.9.0. Sanitiserte Logs liegen gitignored unter `artifacts/rebuild-2026-09-06/`.

Die Produktionsstichprobe belegt keine vollständige 14-Bereiche-Matrix: 200 % Zoom, Screenreader, weitere Rollen/Impersonation/Widerruf, vollständige Zustände und authentifizierte Kandidatenparität sind offen. Keine produktiven Geschäftsdaten, Rollen, Deals, Pushkonfigurationen, Migrationen oder Backfills wurden durch diese Prüfung verändert. Kein neuer Produktionsdeploy und keine unabhängige Releasefreigabe werden behauptet.

## Nächster ausführbarer Abschnitt

1. Preview-Runtime mit einer autorisierten Test-Datenanbindung bereitstellen. Supabase-MCP-OAuth ersetzt keine Server-Environment-Variablen; lokale Provider-/Service-Keys sind nicht befüllt. Keine Secrets in Chat, Repository oder Asana hinterlegen.
2. Den geprüften unveränderlichen Kandidaten samt Vercel-Commitzuordnung und anschließend mit angemeldeter Sitzung prüfen. Scope-/Finanz-APIs mit autorisierten eingeschränkten internen und Partner-Testidentitäten abnehmen.
3. Den Fraud-Speicherverbrauch mit repräsentativer Datenmenge messen und in einem eigenen begrenzten Paket reduzieren; Parität und Vollständigkeit müssen erhalten bleiben. Kein pauschales Erhöhen von Ressourcen oder Verkürzen fachlicher Datenfenster.
4. Den vorbereiteten Affiliate-Index erst nach Backup-/Speicherprüfung, bestätigtem Autocommit-Kanal, unmittelbarer Zustandsvorschau und ausdrücklicher Freigabe ausführen. Ausführung, Plan/Laufzeit und Rollback getrennt zurücklesen.
5. Für administrative/providerseitige Schreibtests jeweils den exakten Testscope unmittelbar vor der einzelnen Mutation freigeben; Audit, Provider-/lokaler Read-back, Reconciliation und Rollback nachweisen.
