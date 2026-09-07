# 365-Tage-Abnahme und mobile Jahreskennzahlen

Am 07.09.2026 wurde auf `73d3eec17cb072da5bb308411a7bf36289ec51ff` die echte Auswahl „365 days“ im Account Monitor geöffnet. `period=all` zeigt die eingeschlossenen Berlin-Datumsgrenzen 08.09.2025–07.09.2026. Dies ist die dokumentierte Produktentscheidung A; es gibt keine Lifetime-Auswahl.

## Produktionsdaten, ausschließlich gelesen

Read-back um 11:30:42 UTC aus `daily_metrics`: ältester Tag 23.07.2025, jüngster Tag 07.09.2026, insgesamt 445.422 Zeilen. 35.563 ältere Zeilen liegen vor dem ausgewählten Fenster; 409.859 Zeilen liegen darin. Die Oberfläche stimmt für alle sieben Hauptkennzahlen mit der Summe im Fenster überein:

| Kennzahl | Datenbank und Oberfläche |
|---|---:|
| Klicks | 5.274.787 |
| SOIs | 628.093 |
| First Sales | 16.884 |
| Rebills | 131.533 |
| Umsatz | 4.674.411,44 EUR |
| Payout | 1.360.454,67 EUR |
| Profit | 3.313.956,77 EUR |

Die Geldwerte stimmen nach Rundung auf Cent überein. Dies belegt den Zeitraumfilter über die produktive Reporting-Datenquelle; es ersetzt keine vollständige Conversion-/History-Parität. Der separate Leitstand bleibt deutlich als 30-Tage-Rollup mit unvollständiger Coverage ausgewiesen.

## Gefundener und korrigierter Darstellungsfehler

Bei echten 390×844 CSS-Pixeln liefen Jahresumsatz und First-Sales-/Rebill-Zahl über ihre zweispaltigen Kennzahlenkarten. DOM-Messung: 135 Pixel Inhaltsbreite, 152 bzw. 165 Pixel Textbreite. Große Median-Deltas ragten ebenfalls über den mobilen Tabellenkartenrand.

Unter 560 Pixeln stehen die Kennzahlen jetzt in einer Spalte. Lange Werte und Median-Deltas dürfen umbrechen. Die folgende Prüfung auf `a1bc445` bestätigte die mobile Korrektur, zeigte jedoch auch im fünffachen Desktop-Raster zu breite Jahreswerte: 173 Pixel Inhaltsbreite bei 182 bzw. 198 Pixel Textbreite. Die Schriftgröße der Kennzahlen richtet sich deshalb zusätzlich zwischen 18 und 24 Pixeln nach der verfügbaren Kartenbreite. Desktop-/Tablet-Raster und Kennzahlenberechnung bleiben gleich. Der anfänglich direkt nach Viewportwechsel gemessene Body-Überlauf war vorübergehend; nach Layoutabschluss lagen Body und Dokument bei 379 Pixeln. Die Korrektur begründet sich auf dem reproduzierten Textüberlauf innerhalb der Karten.

## Grenzprüfungen

Verhaltenstests prüfen die Berliner Tagesumschaltung im Sommer und Winter, beide DST-Wechsel, den Schalttag und den aktuellen Abnahmetag. Jeder Bereich enthält genau 365 Datumswerte. Ein explizit ausgewählter ältester Bestandstag wird unverändert an die Reporting-Abfrage weitergegeben; freie historische Fenster werden nicht still auf 365 Tage gekürzt.

Die neuen Grenztests prüfen vorhandenes korrektes Verhalten. Für die CSS-Korrektur dient die reale Browsermessung als Vorher-/Nachher-Nachweis. Vollständiger Deployment-/Browser-Read-back und Asana-Abschluss werden nach Veröffentlichung in der PR-Beschreibung und im Prüfbericht dokumentiert.
