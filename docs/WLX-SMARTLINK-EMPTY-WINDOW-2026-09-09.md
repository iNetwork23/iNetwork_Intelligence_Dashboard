# Smartlink: leeres Reifefenster ist noch keine Datenabdeckung

Produktiv beobachtet am 09.09.2026 um 10:10 UTC, Super Admin, Affiliate 6 / Campaign 2: Die Campaign wurde am selben Kalendertag gespeichert. Das separate Reifefenster beginnt am Folgetag und enthält deshalb noch keinen abgeschlossenen Tag. Die Quellenkarte zeigte trotzdem „0 von 0 Tagen“, das rückwärts laufende Datum 10.09.–09.09. und „Vollständige Source-Abdeckung“ samt scheinbar gemessenen Nullwerten.

Die Quellenkarte kennzeichnet diesen Zustand jetzt ausdrücklich als noch nicht auswertbar. Sie zeigt n/a und erklärt den Beginn nach dem ersten abgeschlossenen Kalendertag. Die gemeinsame Coverage-Prüfung verlangt zusätzlich einen nicht leeren, aufsteigenden Zeitraum. Dadurch können fehlende Source×LP-Zellen ohne Reifetag nicht länger zu bestätigten Nullzellen und vergleichbaren Gewinnern/Verlierern werden. Vollständig belegte Tage ohne Ereignisse bleiben echte Nullwerte.

Drei Regressionen reproduzierten zuerst den Fehler: leeres Fenster, umgekehrter Zeitraum trotz positiver Tageszahl sowie gerenderte Quellenkarte. Bestehende Nachweise für vollständige, teilweise und fehlende Abdeckung bleiben erhalten. Campaign-Zahlen, Routing, Status, Auszahlung und Geschäftsregeln werden nicht verändert.
