# Conversion-Seiten bei bestätigtem SQL-Timeout verkleinern

Der produktive Nachlauf mit Keyset-Pagination veröffentlichte am 09.09.2026 um 10:19 UTC beide Source-Snapshots ohne Speicherabbruch: 30d 109 Zeilen/9 von 49 Partnern, 7d 110 Zeilen/13 von 38 Partnern. Die Abdeckung blieb unvollständig; Affiliate 154 meldete erneut ein Statement-Timeout. Die unveränderten Partner-/Routenbudgets bleiben bindend.

Read-only EXPLAIN ANALYZE bestätigt den vorhandenen partiellen Index: erste Seite 1000 Zeilen in 160 ms, zweite Seite einschließlich JSON-Aggregation in 231,414 ms. Diese direkten SQL-Messungen reproduzieren nicht sämtliche produktiven API-Bedingungen und sind kein allgemeiner Performance-PASS.

Der Conversion-Leser halbiert jetzt ausschließlich nach einem gemeldeten Statement-Timeout die Seitengröße am unveränderten Cursor: 1000 → 500 → 250 → 125. Bereits vollständig geladene Seiten bleiben erhalten, fehlgeschlagene Seiten verschieben den Cursor nicht. Der Abbruchvergleich verwendet die tatsächlich angeforderte Seitengröße, damit ein voller 500er-Block nicht irrtümlich als letztes Ergebnis gilt. Ein weiterer Timeout bei 125 Zeilen oder ein anderer Datenbankfehler bricht weiterhin ohne Teilergebnis ab.

Diagnosen enthalten ausschließlich Affiliate, Zahl geladener Seiten und Seitengröße, keine Conversion- oder Kundenkennungen. Zwei Regressionen scheiterten vor der Änderung. Sie belegen vollständige Fortsetzung über eine verkleinerte Seite und das begrenzte Scheitern nach ausgeschöpften Versuchen; der Nicht-Timeout-Fall bestätigt, dass Berechtigungsfehler nicht erneut versucht werden.
