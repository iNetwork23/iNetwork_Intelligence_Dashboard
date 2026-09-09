# Vollständige Reporting-Zeiträume während des Jahresimports

Produktionsbefund am 09.09.2026: 121 bestätigte Berlin-Tage (Version 5, TZ 56) reichen für 7, 30 und 90 Tage. Der folgende Jahreslauf scheiterte mit 121/365 Tagen und verhinderte dadurch die Veröffentlichung sämtlicher vorbereiteter Portfolio-Ranges und der Source-Kandidaten.

Die Hintergrundberechnung behandelt ausschließlich `IncompleteBerlinReportingRangeError` pro Zeitraum. Vollständig belegte Ranges werden veröffentlicht; fehlende Zeiträume werden mit Datum und bestätigter/erforderlicher Tageszahl zurückgegeben. Datenbankfehler bleiben fatal. Bei null vollständigen Ranges findet kein leerer Upsert statt. Die Source-Berechnung läuft anschließend unter ihren unveränderten eigenen Coverage-Prüfungen und Zeitbudgets.

Die Route liefert bei fehlenden Portfolio-Zeiträumen HTTP 503 mit `portfolioComplete:false`, `incompleteRanges`, veröffentlichten `snapshots` und den einzelnen `sourceCandidates`-Ergebnissen. Vollständige Portfolio-Coverage liefert weiterhin 200. Source-Ergebnisse sind separat auszuweisen; `portfolioComplete` behauptet keinen vollständigen Source-Import. Sperrfreigabe erfolgt weiterhin im `finally`.

Der aktuelle Audit hat zusätzlich zwei hohe Abhängigkeitsbefunde offengelegt. `sharp` einschließlich Override wurde auf 0.35.4 und der `js-yaml`-Override auf 4.3.2 aktualisiert. Dies sind die vom jeweiligen Maintainer veröffentlichten Korrekturen: [sharp](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c), [js-yaml](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh).

Validierung: Regression zunächst mit zwei erwarteten Fehlern reproduziert; nach Korrektur 33 gezielte Tests, gesamtes Repository einschließlich Abhängigkeitsupdates 221 Dateien / 1.785 Tests bestanden. Typecheck, Next-Build und Diffcheck bestanden. Lint: null Fehler, zwei bereits bekannte Warnungen. Vollständiger und Produktions-Audit: jeweils null Schwachstellen. Keine SQL-, Cron-, Provider-, Rechte- oder Geschäftsregeländerung.

Produktive Veröffentlichung und Datenbank-Read-back werden separat im datierten Arbeitsnachweis dokumentiert. Ein erfolgreicher technischer Check schließt die noch offenen fachlichen WLX-Abnahmen nicht ab.
