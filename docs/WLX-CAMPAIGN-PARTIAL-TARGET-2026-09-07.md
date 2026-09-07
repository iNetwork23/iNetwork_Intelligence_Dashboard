# Campaign-Tiefenanalyse bei unvollständigen Eventdaten

Der echte Klick auf Campaign 23 im Workspace des zugeordneten Partners lieferte die korrekte URL mit `campaign=23#campaign-23`. Die Ersatzansicht für unvollständige Eventdaten hatte jedoch kein entsprechendes HTML-Ziel. Bei 1440 Pixeln lag ihr Anfang unterhalb des sichtbaren Bereichs; `document.getElementById('campaign-23')` war null. Dadurch wurde die bestehende CTA-Korrektur gerade im produktiv auftretenden Partial-Zustand nicht vollständig wirksam.

Die Ersatzansicht besitzt jetzt dasselbe eindeutige Campaign-Ziel wie die vollständige Ansicht. Zusätzlich stehen die tatsächlichen Event-Zeiträume unmittelbar bei den LP-Zahlen. Die Campaign-Event-Summe benennt ausdrücklich die darunter ausgewiesenen LP-Zeiträume. Damit kann eine 30-Tage-Finanzbilanz nicht stillschweigend als Zeitbasis eines separaten 14-Tage-Eventfensters gelesen werden. Fehlende Coverage-Metadaten werden als nicht belegter Event-Zeitraum bezeichnet.

Die Regression für den produktiven Partial-Fall scheiterte zunächst am fehlenden Ziel. Nach der Änderung bestehen der Ziel-/Zeitfensterfall sowie die vorhandenen CTA-/Anchor-Regressionen. Alle bisherigen fail-closed Bewertungsgates bleiben bestehen.

Der lesende Produktionsabgleich für den zugeordneten Partner/Campaign ist im lokalen Bericht und in Asana dokumentiert: die Finanzbilanz stimmt mit den akzeptierten Tages-Snapshots überein; die sieben angezeigten LP-Eventzahlen stimmen mit den kanonischen Conversions für dieselben akzeptierten Tage überein. Ein ungefilterter Vergleich über den 30-Tage-Zeitraum oder allein mit Snapshot-Events wäre fachlich falsch. Fehlender Snapshot-Tag und unvollständige Eventabdeckung bleiben sichtbar; daraus entsteht keine Stop-/Scale-Empfehlung.

Dieses Paket ändert Darstellung und Navigation. Es löst keinen Provider-Write, Datenbackfill oder Campaign-Statuswechsel aus. Der tatsächliche neue Deployment-SHA, Desktop-/Mobilklick und Back/Forward werden nach Veröffentlichung zurückgelesen.
