# Wiederaufnahme unterbrochener Fraud-Aktualisierung

Produktiver Befund am 09.09.2026: Nach bereits bestätigtem Cutover wurden ab 15 Uhr wieder Mai-Tage importiert. SQL um 19:28 UTC bestätigt `nextFrom=2026-05-25` und einen ungültigen Cutover. Der nächste Lesezugriff interpretierte den vor einer Rolling-Reparatur absichtlich invalidierten Checkpoint als unbewiesenen Altbestand und begann wieder beim gesamten 120-Tage-Fenster.

Vor einer Rolling-Mutation wird nun der genaue Reparaturbereich als ausstehender Backfill gespeichert. Das gilt ausschließlich bei starkem vorherigem Paritätsnachweis, zusammenhängender Coverage und höchstens drei Berliner Tagen. Cutover, letzte Parität und öffentliche Bereitschaft werden weiterhin vor jeder Mutation invalidiert. Ein unterbrochener Lauf wiederholt den ersten betroffenen Tag und arbeitet anschließend bis zum gespeicherten Reparaturende weiter. Erst die vollständige neue Typ-/Identitätsparität stellt die Bereitschaft wieder her.

Unbelegte Altzustände, schwache Digests, Lücken oder zu große Fenster erhalten keine verkürzte Wiederaufnahme. Bereits produktiv verlorene Checkpoints werden durch dieses Paket nicht rückwirkend rekonstruiert. Schema, Cronpläne, RPC-Budgets und Providerregeln bleiben unverändert.

Drei Service-Regressionen reproduzierten vor der Korrektur den Rücksprung auf Mai: Teilfehler bei Conversion-Ersetzung, Fehler bei Berichtsersatz und Catch-up nach Berliner Mitternacht. Vier zusätzliche Negativfälle sichern unbewiesene Historie ab. Alle 238 Testdateien / 1.936 Tests, Produktionsbuild, TypeScript und Diffprüfung bestanden; Lint 0 Fehler / 2 bekannte Warnungen, vollständiger Dependency-Audit 0 Befunde.
