# Fraud: verlässliche Formularrückmeldung und englische Oberfläche

Nach erfolgreichem Speichern eines dokumentierten Stop-Requests wurde im Formular `event.currentTarget.reset()` erst nach dem Netzwerkaufruf ausgeführt. React hatte `currentTarget` dann bereits zurückgesetzt. Die Oberfläche meldete deshalb einen Fehler und aktualisierte die Ansicht nicht, obwohl der Server erfolgreich geantwortet hatte.

Die Formularreferenz wird jetzt vor dem ersten `await` gesichert. Ein erfolgreicher Request setzt die Eingaben zurück und aktualisiert die Ansicht; eine Ablehnung erhält die Eingaben und zeigt den Serverfehler. Der Regressionstest reproduzierte zunächst `Cannot read properties of null (reading 'reset')`; der Fehlerfalltest bestand bereits. Requestinhalt, Berechtigungen, 24-Stunden-Grenze und Provider-Verhalten sind unverändert. Die Tests verwenden ausschließlich lokale simulierte Antworten; kein produktiver Stop wurde angelegt.

79 fehlende statische UI-Texte wurden dem bestehenden Sprachwörterbuch hinzugefügt: Fraud-Sicherheits-/Coverage-Hinweise, Qualitäts- und Risikobeschriftungen, Filter, Formulare, Status sowie die restlichen Source-Vorschautexte. Geschäftsdaten und technische Identitäten werden nicht durch neue allgemeine Wortersetzungen übersetzt.
