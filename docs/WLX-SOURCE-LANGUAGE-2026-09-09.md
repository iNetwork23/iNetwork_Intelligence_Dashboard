# Englische Source-Statusmeldungen

Die produktive Sources-Seite zeigte in einer englischen Sitzung deutsche Filtertitel (Modus, Sortierung, Suche), Rollup-/Coverage-Fragmente, Kandidatenzahlen, Reifehinweise, Leadstatus und Sync-Hinweise. Der leere Suchfilter funktionierte, zeigte aber weiterhin „0 von 108 Kandidaten“.

Die vorhandene Übersetzung erhält fehlende feste Texte und eng verankerte Vorlagen für bekannte dynamische Meldungen. Zähler, Grenzen und IDs werden beibehalten. p75-Stunden erhalten den passenden Dezimaltrenner. Unbekannte Geschäftsbezeichnungen und Source-IDs werden nicht durch Teilwortersetzungen verändert. Datenabfragen, Entscheidungen, Rollen und Source-Sperren bleiben unverändert.

Regression zuerst: 20 von 21 ursprünglichen Fällen schlugen fehl, darunter die tatsächliche Ausgabe von maturityLabel. Nach der Korrektur samt zwei p75-Fällen: 225 Testdateien / 1.838 Tests bestanden. Frisches npm ci, TypeScript, Produktionsbuild und Diffcheck bestanden; Lint null Fehler / zwei bestehende Warnungen. Voll- und Produktionsaudit: null Befunde. Die native Nachprüfung des unveränderlichen Deployments wird in den Arbeitsnachweisen dokumentiert.
