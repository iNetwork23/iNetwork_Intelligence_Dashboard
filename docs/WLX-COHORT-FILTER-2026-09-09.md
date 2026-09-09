# Leere Kohortenfilter bedeuten alle erlaubten Quellen

Reproduktion in Produktion am 09.09.2026: Das Partnerformular sendet leere `source`- und `sub_source`-Felder. Der Seitenpfad reichte diese als leere Strings an die SQL-RPC weiter, während der API-Pfad sie bereits als fehlende Filter behandelte. SQL deutete die Strings als exakte leere Dimensionen.

Affiliate 6 zeigte dadurch 27 Gruppen, 38.433 Registrierungen und 0 EUR Kohortenumsatz. Derselbe materialisierte Datenstand enthält ohne optionale Quellenfilter 4.215 Gruppen, 51.731 Registrierungen, 72.069,06 EUR Umsatz nach 90 Tagen und 86.088,50 EUR nach 365 Tagen. Nachweis: SQL 09:47:02 UTC, materialisierter Stand 09:30:16 UTC. Dies ist ein Filterfehler, kein Beleg für fehlenden Partnerumsatz.

Der gemeinsame Leser normalisiert leere und nur aus Leerzeichen bestehende optionale Filter zu SQL NULL. Nichtleere Kennungen einschließlich `0` und bedeutungstragender Leerzeichen bleiben exakt erhalten. Die verpflichtenden Berechtigungsscopes bleiben separate RPC-Parameter; Fremdscope-Abweisung bleibt bestehen.

Drei neue Regressionen scheiterten vor der Korrektur; vier neue Fälle prüfen leere Formularwerte, beide Quellenarten, verpflichtende Scopes und exakte Kennungen. Gesamtsuite: 221 Dateien / 1.789 Tests bestanden. Build, Typecheck, Diffcheck bestanden; Lint null Fehler / zwei bestehende Warnungen. Abhängigkeiten unverändert gegenüber PR #37 mit null Auditbefunden. Produktive Nachprüfung folgt nach Deployment.
