# Tagesweise Wiederverwendung der Source-Aktivität

Der produktive Rollup nach PR #45 erreichte am 09.09.2026 nur 6/49 Partner in 30d und 8/38 in 7d. Die Conversion-Leseview wurde erfolgreich genutzt; beide Snapshots hatten keine fehlende Reifeauswertung, blieben aber im Zeitbudget unvollständig. Im Aktivitätsleser invalidierte jede geänderte Tagesgeneration den gesamten Jahresmemo. Der folgende Aufbau las alle verfügbaren Rohsnapshots erneut.

Die Aktivität wird jetzt zusätzlich unter `source_activity_day:berlin-v5:<date>:<affiliate>` als kompakte Tageszusammenfassung gespeichert. Der Wert enthält Version, Affiliate, Datum und die exakte immutable Quellgeneration. Gültige unveränderte Tage werden wiederverwendet, andere Tage einzeln aus ihrem exakten Rohsnapshot aufgebaut. Aus allen aktuell akzeptierten Tagesständen wird das Maximum neu berechnet; dadurch werden auch entfernte Leads und aus dem Fenster gefallene Tage korrekt berücksichtigt. Der bisherige vollständige Jahresmemo bleibt der schnellste Lesepfad.

Cache-Reads enthalten höchstens acht kompakte Tageswerte, Rohdaten werden weiterhin tagweise dekodiert. Fehlende Affiliate-Tagesdatensätze dürfen leer sein; fehlerhafte oder fremde zurückgelieferte Datensätze brechen den Jahresaufbau ab. Cachefehler führen zum Rohdatenpfad. Ein späterer Rohdatenfehler veröffentlicht keinen teilweisen Jahresmemo. Gültige frühere Tagesmemos dürfen bestehen bleiben. Die Datumsschlüssel werden bei einer Generationenänderung ersetzt, sodass keine zusätzliche Schlüsselhistorie pro Generation entsteht.

Keine SQL-Migration, keine Rechte- oder Geschäftsregeländerung. Die neuen Werte liegen in der bestehenden internen sync_state-Tabelle und enthalten nur kompakte Quellidentitäten/Aktivitätsdaten. Sie lassen sich durch Zurücksetzen des Codes gefahrlos ignorieren; Bestands-Conversions und Berichtszeilen bleiben unverändert.

Regression zuerst: drei von vier initialen Fällen scheiterten. Abschließend sechs neue Verhaltensfälle, darunter geänderte Generation, entferntes letztes Lead, entfernte Marker, fremder Cache/Rohdatensatz, Cachefehler und legitimer leerer Tag. Im Aktualisierungsfall wird genau ein geänderter Rohdatentag gelesen statt aller drei Fixture-Tage. Frisches npm ci; 226 Testdateien / 1.844 Tests, Typecheck, Build und Diffcheck bestanden. Lint null Fehler / zwei bestehende Warnungen; beide Dependency-Audits null Befunde.

Der erste produktive Aufbau muss die neuen Tagesmemos füllen. Ein globaler Performance-Erfolg wird erst nach tatsächlichem Rollup-Read-back behauptet.
