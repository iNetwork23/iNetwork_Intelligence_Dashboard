# Fraud: 90-Tage-Abfrage ohne wachsende Offsets

Nach abgeschlossenem 120-Tage-Backfill und aktuellem Tagesabgleich funktionierten 7 und 30 Tage einschließlich Conversion-Cutover. Der produktive 90-Tage-Aufruf vom 09.09.2026, 12:02:45 UTC scheiterte dagegen an `Supabase Fraud-Conversions: canceling statement due to statement timeout` auf Release 74ad7033646945dc4bd58386be7bbb52b67c538f. Die Seite zeigte einen Ladefehler; HTTP 200 der bereits gestarteten Stream-Antwort war kein Erfolg.

Der Loader las bisher vier parallele OFFSET-Seiten und erhöhte den Offset über das gesamte Fenster. Er liest jetzt jeweils genau einen Berliner Tag und setzt innerhalb des Tages mit unverändertem PostgreSQL-Zeitstempel plus ID fort. Sommerzeit-Tage behalten ihre 23/25 Stunden. Ein Timeout verkleinert nur die noch ungelesene Seite von 1000 bis mindestens 125 Zeilen. Nicht wiederholbare Fehler und unveränderte Cursor bleiben Fehler; es wird kein Teilresultat veröffentlicht.

Alle bisherigen Spalten, Statusklassen, Scrub- und Fehlerflags bleiben enthalten. Die approved-only-View wird hier ausdrücklich nicht verwendet, weil Fraud auch abgelehnte Ereignisse benötigt. Jede Seite wird sofort in die bestehenden Fraud-Objekte überführt; es wird nicht zusätzlich das gesamte rohe Datenbankarray gehalten. Keine Schema-, Rechte-, Budget-, Score-, Import- oder Provideränderung.

Sechs zusätzliche Regressionen prüfen mehr als 1000 identische Zeitstempel, Mikrosekunden, Sonderzeichen in IDs, abgelehnte/gescrubbte Ereignisse, kleinere Wiederholungsseiten, Grenzen des Berlin-Tages, wiederholte Cursor, harte Fehler, leere Tage und den 25-Stunden-Sommerzeitwechsel. Die fünf zuerst angelegten Regressionen scheiterten am alten Offsetpfad; nach Umstellung bestehen sie samt neuem Tagesgrenzfall. Der vorhandene Checkpoint-/Invalidierungsschutz wird weiterhin getestet.

Ein erster produktiver EXPLAIN ANALYZE des Cursor-Ansatzes über acht Tage nutzte zwar conversions_converted_at_idx, sortierte aber noch 18.935 Treffer für 1000 Rückgaben (572,122 ms). Deshalb wird zusätzlich pro Berlin-Tag begrenzt. Der endgültige Release benötigt erneut die native 90-Tage-Abnahme.

Die endgültige tagesbegrenzte Referenzabfrage für den 01.09. lieferte 1.000 Zeilen in 6,708 ms. Sie verwendet einen Index Scan mit inkrementeller Sortierung über den bestehenden Zeitindex. Dies ist eine einzelne SQL-Referenzmessung; die vollständige HTTP-/UI-Abnahme wird getrennt protokolliert.
