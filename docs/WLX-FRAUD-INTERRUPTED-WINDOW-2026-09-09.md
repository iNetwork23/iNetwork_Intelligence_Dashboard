# Unterbrochenen Fraud-Abschnitt kleiner wiederholen

Der produktive Fraud-Lauf vom 09.09.2026 um 10:05:40 UTC für 29.–31.07.2026 erreichte Vercels unverändertes 300-Sekunden-Limit (504). Der Cursor blieb auf 29.07., readyAt blieb null und die vor dem Schreiben invalidierte Parität wurde nicht als Erfolg wiederhergestellt. Der planmäßige Lauf 10:07 wurde durch die gemeinsame Reporting-Sperre korrekt abgewiesen. Ein abgeschlossener Juli-Abschnitt wird nicht behauptet.

Ein Backfill mit vorhandenem früherem Erfolg, aber invalidierter letzter Parität kennzeichnet einen nicht abgeschlossenen Versuch. Der nächste Lauf wiederholt jetzt ausschließlich den unveränderten ersten Tag. Nach vollständiger Zählwert- und Identitätsparität wird der Cursor um diesen einen Tag weitergesetzt und die reguläre Drei-Tage-Größe wieder verwendet. Die bestehende Tages-Transaktion macht die Wiederholung idempotent. Erstimport, Rolling-Reparatur und Catch-up behalten ihre bisherigen Fenster.

Zusätzlich protokolliert der Lauf ausschließlich Datumsgrenzen, Stufen, verstrichene Millisekunden und aggregierte Zeilenzahlen. Damit wird bei einem weiteren Abbruch sichtbar, ob Providerlesen, Conversion-Ersatz oder Reporting-Ersatz betroffen war. Keine Providerzeilen, Kundenkennungen oder Geheimwerte werden protokolliert.

Die neue Regression scheiterte zuvor am dreitägigen Wiederholungsfenster. Sie prüft den unveränderten Cursor, den Einzeltag, die unveränderte Paritätspflicht und die Rückkehr zur regulären Größe nach Erfolg. Keine SQL-, Timeout-, Cron-, Geschäfts- oder Coverage-Ausweitung.
