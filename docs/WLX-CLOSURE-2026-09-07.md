# Prüfung offener Aufgaben, 7. September 2026

Ausgangsstand: 222033b728903fdd059f0b143a5ce93425435f9d, produktiv als dpl_39GpdvuRyQjRAeB5WULtpvTLoip1. Die Veröffentlichung weiterer geprüfter Anwendungskorrekturen ist bereits autorisiert. Vollständige fachliche Abnahme und einzelne schreibende Produktionsscopes sind davon getrennt.

## Reproduzierte und korrigierte Anwendungspfade

- **B, Hydrierung:** Der DOM-Übersetzer ändert den Reset-Link in einer noch nicht hydrierten Suspense-Grenze von Deutsch auf Englisch. Der neue Regressionstest reproduziert denselben React-Textmismatch wie die Produktionskonsole. InstantLink besitzt nun seine Texte und Attribute selbst; der Hydrierungssnapshot bleibt Deutsch, danach folgt die gewählte Sprache. Verschachtelte Linktexte, Geldwerte, geschützte IDs und Rückwechsel nach Deutsch werden geprüft. Keine Unterdrückung der Fehlermeldung. Grundlage: [React hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot).
- **A/B, Fraud-Speicher:** Der zuvor protokollierte OOM traf den accountweiten Fraud-Aufruf. Die aktive Source-Historie enthält pro Tag bis zu etwa 26.600 Quellzeilen. Der alte Leser behielt sämtliche expandierten Reportobjekte mit vielen Dimensionsobjekten über den gesamten Zeitraum, bevor er sie erneut in Fraud-Metriken überführte. Der neue Leser verarbeitet höchstens 100 Snapshotobjekte pro Antwort und verdichtet jeweils nach Affiliate, Offer, Campaign, Landingpage, Trafficmodus und vollständigem Attributionspfad. Reihenfolge und numerische Gruppierung innerhalb eines Snapshots bleiben erhalten. Ein Test verdichtet 50.000 Tageszeilen zu acht identischen Auswertungsgruppen; das gesamte Bewertungsergebnis bleibt gleich. Der reale OOM-Nachweis muss nach Deployment erneut geprüft werden.
- **B, Fehlerzustand:** Ein Snapshot ohne Zeilenarray wird als unvollständig abgewiesen, statt trotz fehlender Daten Source-Vollständigkeit zu behaupten. Die bisherigen Cutover-, Rechte-, Reife- und Provider-Schreibgrenzen bleiben erhalten.

## LTV-Ursache und exakt vorbereiteter Eingriff

Read-back 2026-09-07 etwa 04:49 UTC: Die Funktion refresh_ltv_cohorts_v1 hat statement_timeout=900s. Der bestehende Stundenjob (jobid 1) führt nur `select public.refresh_ltv_cohorts_v1();` aus. Das äußere Statement startet mit 120s. Die letzten drei Läufe endeten jeweils nach etwa 120 Sekunden; der Cron-Aufruf selbst meldete succeeded, während sync_state den abgefangenen Fehler refresh_timeout enthält. Cron-succeeded allein belegt daher keinen erfolgreichen Refresh.

Vorbereitete Migration: `supabase/migrations/20260907095257_repair_ltv_cron_statement_budget.sql`. Sie prüft den unveränderten Ausgangsbefehl und ändert ausschließlich den Stundenjob auf ein vorangestelltes 15-Minuten-Statementbudget. Kein neuer Job, kein geänderter Stundenplan und kein manueller Refresh/Backfill. Das längere Budget kann beim nächsten planmäßigen Lauf längere Datenbanklast verursachen. Der Rückweg prüft den Reparaturbefehl und setzt nur diesen zurück.

Historischer Status bei Erstellung: Freigabe angefragt. Aktualisierung 7. September 09:52:57 UTC: Nutzerfreigabe erteilt und genau diese Jobkorrektur angewendet. Die Datei trägt jetzt die tatsächlich registrierte Supabase-Version 20260907095257. Ausführungsjournal und nächste reguläre Laufprüfung: [Fraud-/LTV-Nachweis](WLX-FRAUD-MEMORY-LTV-2026-09-07.md), WLX-006 und externer Prüfbericht.

## Aufgabenabschluss

Saubere Lockfile-Installation durchgeführt. Der abschließende Code besteht 193 Testdateien / 1593 Tests, Lint, Typecheck, Produktionsbuild und Diffprüfung. Vollständiger sowie Production-Audit melden 0 Schwachstellen; npm ls zeigt ausschließlich nanoid 3.3.18. Der konkrete Commit/Tree/Deployment- und Browser-Read-back wird nach Veröffentlichung in Asana und im externen Prüfbericht ergänzt.

WLX-001 und WLX-002 werden anhand ihrer konkreten Tests-/Lockfilekriterien geprüft. Fehlende globale Produktionsdatenparität gehört zum zugeordneten Daten-/Abnahmegate und wird nicht als neu erfundenes Kriterium für das Beheben deterministischer Fixtures oder des Dependency-Befunds benutzt. Aufgaben mit ausdrücklich verlangter Browser-, Rollen-, Provider- oder unabhängiger Abnahme bleiben bis zum jeweiligen Nachweis offen.

Stand der weiteren Grenzen: sichtbare Browserprüfung wartete zunächst auf Entsperren des Mac; Supabase query_logs besitzt weiterhin zu wenig OAuth-Scope. SQL-/Vercel-Read-backs funktionieren. History-Backfill steht vor August 2026, Fraud-Backfill ohne verifizierte Parität. Provider-Pagination (2480/2481) und der Metric-Replacement-Vertragsfehler wurden nicht durch Abschwächen der Prüfungen kaschiert. Source-Stops, Automation-Live, Rollen, Deals, Push und OneSignal benötigen weiterhin ihre konkreten kontrollierten Scopes.
