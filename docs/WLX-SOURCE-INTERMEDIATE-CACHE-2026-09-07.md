# Sources: ungeeigneten Zwischencache entfernen

Die produktive Partneransicht ab 11:12:21 UTC auf 17763cc öffnete nach der Snapshot-Paketbegrenzung erfolgreich. Vercel meldete jedoch zweimal, dass ein 9.991.004 Byte großer Eintrag nicht im Next-Datencache gespeichert werden kann (2-MB-Grenze). Die getrennten Rebill-/Conversion-Timeouts wurden weiterhin korrekt als fehlende Daten behandelt.

Der gemeinsame sourceWindow-Helfer versuchte, expandierte Tageszeilen einschließlich vieler wiederholter Dimensionsnamen noch vor ihrer Aggregation im persistenten Cache zu speichern. Diese Zwischenablage entfällt. Die immutable Tages-Snapshots bleiben in Supabase; die bestehenden Caches der aggregierten Source-Auswertung und Tages-/LP-Auswertung bleiben erhalten. Scopefilter, Taginvalidierung der Ergebnisse und Kennzahlen ändern sich nicht.

Eine Verhaltensregression mit 700 Zeilen und wiederholten Metadaten reproduzierte vor der Änderung einen 3.335.501-Byte-Cacheversuch. Danach wird zuerst aggregiert: alle Kennzahlen bleiben identisch und kein Eintrag dieses Beispiels überschreitet 2 MB. Dies ist keine allgemeine Größenbegrenzung für beliebig viele eindeutige Sources; die produktive Nachprüfung bleibt erforderlich.

199 Testdateien / 1606 Tests, Typecheck, Produktionsbuild und Diffprüfung bestehen. Lint: keine Fehler, eine bestehende Sidebar-Testwarnung. Dependencies/Lockfile unverändert; Audit aus dem unmittelbar vorausgehenden Sources-Paket ohne Schwachstellen. Keine zusätzliche SQL- oder Provideränderung.
