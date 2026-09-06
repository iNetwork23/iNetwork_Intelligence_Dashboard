# WLX: direkter Produktionsrelease und Read-back

Zeitpunkt des Anwendungs-Read-backs: 2026-09-06, 22:24–22:28 UTC (7. September in Europe/Berlin).

Der Nutzer hat die zuvor gewählte separate Testumgebung zurückgenommen und ausdrücklich angewiesen, die geprüften Anwendungskorrekturen direkt live zu veröffentlichen. Der vorbereitete Supabase-Branch wurde nicht erstellt; es wurde keine kostenpflichtige Testressource gebucht. Diese Releaseentscheidung ersetzt keine Behauptung einer vollständigen fachlichen Abnahme oder eines unabhängigen Reviews.

## Verifizierter Anwendungskandidat

- Commit `6d4422e426ac1e51249f0e7822bc553ba98f3414`, Tree `27a5beea3953f83297c4639e867f1c3d977a3b3f`.
- `main` wurde ohne Force-Push exakt auf diesen bereits geprüften Commit vorgezogen. [PR #4](https://github.com/iNetwork23/iNetwork_Intelligence_Dashboard/pull/4) ist als MERGED mit demselben Commit zurückgelesen.
- Vercel-Deployment `dpl_5UjL8PbDxdzMRaCFkog37TXxPoZC`, READY, target `production`, `meta.githubCommitSha` exakt wie oben.
- Produktionsalias [wlx-railway-dashboard.vercel.app](https://wlx-railway-dashboard.vercel.app) ist diesem Deployment zugeordnet; Aliasfehler keiner.
- Vollständige vorangegangene Gates: 189 Testdateien / 1585 Tests, Lint, Typecheck, Build und Diffprüfung bestanden; vollständiger Audit ohne Schwachstellen.

Diese Datei dokumentiert den Anwendungscode-Release. Ein anschließender reiner Dokumentationscommit kann einen zusätzlichen Deployment-Fingerprint besitzen; der endgültige Alias-/Commit-Read-back wird in WLX-000 und im nutzerseitigen Prüfbericht fortgeschrieben.

## Tatsächlich beobachtete Produktionsprüfung

- Öffentlicher Health-Endpunkt: HTTP 200, `ok=true`, `dataSource=warm`.
- Kohorten-API ohne Dashboard-Sitzung: HTTP 401, generische Antwort `Nicht autorisiert`.
- Bereits angemeldete Super-Admin-Sitzung funktioniert auf dem neuen Deployment weiter; Kohortenseite lädt echte Daten.
- Partnerfilter `affiliate=154`: 544 Gruppen und sechs Seiten; auf Seite 1 genau 100 Zeilen, ausschließlich der ausgewählte Affiliate. Dieser Gruppenzähler entspricht der zuvor gelesenen scoped SQL-Stichprobe. Keine vollständige Finanzsummenparität behauptet.
- Echtes produktives Kohortenformular bei 390, 768 und 1440 px geprüft: alle fünf Kontrollen innerhalb des sichtbaren Bereichs, mindestens 44 px hoch. Der zuvor abgeschnittene Subsource-Filter und die Schaltfläche sind jetzt erreichbar.
- Nach dieser Kohortenprüfung keine Error-/Warn-Logs im Browser und keine Error-/Fatal-Logs des neuen Vercel-Deployments im abgefragten Zeitfenster.

## Nachtrag aus der Live-Abnahme

Der Filter-Reset änderte URL und Ergebnisliste, ließ aber einen alten Source-Wert im Eingabefeld stehen. Zwei DOM-Regressionen reproduzieren diesen Fehler auf dem bisherigen Stand. Das Formular erhält nun seine Identität aus dem aktiven Source-/Subsource-/Partnerfilter, sodass eine geänderte URL-Auswahl die sichtbaren Eingaben erneuert. Reine Seitenwechsel mit unveränderten Filtern behalten noch nicht abgesendete Eingaben. Der Nachtrag besteht drei DOM-Tests und die Vollsuite mit 190 Dateien / 1588 Tests sowie Lint, Typecheck, Build, Audit und Diffprüfung. Sein eigener unveränderlicher Deployment-Fingerprint wird nach Veröffentlichung in WLX-000 zurückgelesen.

## Offene Arbeitspakete

LTV meldet weiterhin einen fehlgeschlagenen Refresh, der History-/Fraud-Backfill ist nicht vollständig abgeglichen. Die Anwendungskorrektur verhindert eine falsche Erfolgsmeldung, behebt aber nicht die Datenbank-Laufzeitursache. Der zuvor beobachtete Fraud-Speicherausfall wurde durch dieses Paket ebenfalls nicht behoben.

Die vollständige Rollen-/Impersonation-/Widerrufs-, Zustands-, Zoom-/Screenreader- und Provider-Schreibmatrix bleibt offen. Die nicht konfigurierte Preview ist nach der ausdrücklichen Live-Entscheidung kein vorgeschobenes Hindernis für diesen bereits ausgeführten Release, kann aber spätere isolierte Schreibtests weiterhin sinnvoll unterstützen.

Der zusätzliche Affiliate-Conversion-Index ist ausschließlich vorbereitet. Keine Migration, kein manueller Backfill, keine Source-/Fraud-/Campaign-/Automation-Aktion, keine Rollenänderung, kein Deal-Save und kein Push-Test wurden in diesem Arbeitsblock ausgeführt. Für diese einzelnen Mutationen bleiben die konkreten Preview-/Bestätigungs-/Read-back-/Rollback-Grenzen des Auftrags bestehen.

## Rückweg

Das vorherige Produktionsdeployment `dpl_9STwGFdhpN3rRuL5efJqtB52oacG` mit Anwendungscode `55448c107965308bba87d8c3196c1502a2943fa9` bleibt als benannter Rückkehrpunkt dokumentiert. Bei einer neuen Release-Regression zuerst den aktuellen Alias und den konkreten Fehler abgleichen, dann den Rückweg kontrolliert über Vercel bzw. einen normalen Git-Revert ausführen und Health/Anmeldung zurücklesen. Es wurde kein Probe-Rollback ausgelöst.
