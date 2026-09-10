# Berechtigung direkt vor Deal- und Campaign-Schreibzugriffen

Ausgangsstand: ab0fb4246aea486d44d4f400d817f431780c4813. Betrifft die noch offenen WLX-008-/WLX-009-Abnahmen.

Fünf neue funktionale Deal-Routentests reproduzierten HTTP 200 und eine Speicherung, nachdem während des Registerlesens die Sitzung widerrufen, das Recht entzogen, die Rolle zu Partner geändert oder Benutzer beziehungsweise ausführender Actor gewechselt wurde. Die ursprüngliche Autorisierung am Anfang der Anfrage reichte bis zur späteren Speicherung durch.

Die Route übergibt jetzt eine frische Autorisierungsprüfung an die Speicherfunktion. Diese liest die Sitzung nach dem Register und unmittelbar vor dem atomaren INSERT/UPDATE erneut. Bei fehlender Sitzung, anderer Identität, Actor, Impersonation, Metadatenversion, Datenscope oder fehlendem aktuellen Schreibrecht wird HTTP 403 geliefert. Der bestehende Revisionsvergleich bleibt erhalten. Es wird weder ein Register gespeichert noch ein erfolgreicher Änderungs-Audit erzeugt.

Campaign-Status prüft nach Erwerb der Sperre sowie innerhalb des Provideradapters nach dessen letztem GET und unmittelbar vor dem PUT. Der bereits geprüfte Campaign-Scope muss unverändert sein. Erforderliche Rücknahmen einer bereits ausgeführten Änderung bleiben möglich, auch wenn die Sitzung inzwischen widerrufen wurde: ein verlorenes Recht darf die Wiederherstellung des Vorzustands nicht verhindern.

Die Tests prüfen erlaubte Schreibpfade, Entzug während langsamer Lesephasen, Identitäts-/Actor-/Versions-/Scope-/Impersonationwechsel, einen entfallenden Provider-PUT und einen weiterhin ausführbaren verifizierten Rollback. Es wurden keine produktiven Deal-Regeln oder Campaign-Statuswerte für diese Tests geändert. Das ist ein Code- und Verhaltenstestnachweis; die noch offenen authentifizierten Produktions- und Geschäftsablaufabnahmen werden dadurch nicht als abgeschlossen ausgewiesen.

Keine Migration und keine Änderung an Rollen, Berechtigungen, Dealwerten, Provider-Routing oder Cronplänen. Der normale autorisierte Schreibpfad erhält zusätzliche Sitzungslesevorgänge. Eine externe Sitzungsspeicherung und ein Provider-PUT sind keine gemeinsame atomare Transaktion; der Nachweis betrifft den letzten prüfbaren Zeitpunkt vor dem Schreiben.
