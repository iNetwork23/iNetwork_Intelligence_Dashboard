# Fraud-Nachholen ohne unnötige Refresh-Pause

Der Import prüfte die 55-Minuten-Pause vor der Auswahl des nächsten Fensters. Dadurch wurde ein gerade beendeter historischer Backfill bereits als übersprungen gemeldet, obwohl spätere Berliner Tage noch fehlten. Derselbe Fall trat am Berliner Mitternachtswechsel auf.

Das maximal drei Tage lange Fenster wird jetzt zuerst bestimmt. Nur ein bereits abgedecktes Refreshfenster darf innerhalb von 55 Minuten übersprungen werden. Fehlende Nachholtage behalten dieselben Lease-, Invalidierungs-, Tagestransaktions- und Paritätsgrenzen und werden unmittelbar bearbeitet. Die tägliche Datumsgrenze stammt unverändert aus selectFraudBackfillWindow in Europe/Berlin.

Regression zuerst: zwei neue Servicefälle scheiterten (kürzlich abgeschlossener historischer Backfill und Berlin-Mitternacht vor UTC-Mitternacht). Ein dritter Fall bestätigt die unveränderte Pause für bereits aktuelle Coverage. Das Runbook wurde auf den tatsächlich eingesetzten v4-Checkpoint, v5-Berlin-Berichte, vorhandene Importfreigaben und geprüfte Fortsetzungsreihenfolge aktualisiert; vorhandene SQL-Objekte werden nicht blind wiederholt.
