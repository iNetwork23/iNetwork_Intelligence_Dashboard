# Source-Dialog: Tastatur und englische Beschriftungen

Produktiv reproduziert auf 390×844: Tab vom Abbrechen-Knopf verließ den modalen Source-Dialog und fokussierte den Hintergrund. Der Dialog hielt außerdem deutsche Scope-Aktionen, Reife-/Lead-Status, Trend und Wirkungsbeschreibung im englischen Modus.

Der Fokus startet jetzt auf Schließen, läuft mit Tab/Shift+Tab zwischen den verfügbaren Bedienelementen und wird nach Escape oder Abbrechen an den Auslöser zurückgegeben. Versuche, den Hintergrund zu fokussieren, bleiben im Dialog. Der laufende Vorschau-/Schreibzustand löst keinen erneuten Fokuswechsel aus; Escape bleibt während der Verifikation gesperrt. Scrollzustand und Ereignishandler werden beim Schließen wiederhergestellt.

Übersetzt werden bekannte Source-/Sub1-/ADV1-/ADV2-Aktionstexte sowie die konkreten Wirkungs- und Fehlermeldungen. Identitäten innerhalb der Aktionstexte bleiben erhalten. Reife, Lead-Status und Trend werden getrennt gerendert, damit vollständige bekannte Texte übersetzt werden können. Auswahl-, Grund- und Bestätigungsregeln sowie Provider-Aufrufe bleiben unverändert.

Die offerübergreifende Bestätigung verlangt jetzt außerdem eine erfolgreiche, nicht leere Vorschau mit vorgegebenem Quellenwert. Zuvor konnte eine leere fehlgeschlagene Vorschau nach Auswahl eines Grundes die Schaltfläche freigeben; die Serverprüfung blieb geschützt. Der Fehler erscheint jetzt im geöffneten Dialog. Die Client-Aktion prüft denselben Zustand nochmals vor dem POST.

Fünf zusätzliche DOM-/Sprachregressionen prüfen Fokuszyklen, Hintergrundschutz, Escape/Cancel-Rückgabe, englische Kennzahlen/Wirkung, unveränderte IDs, deaktivierte Bestätigung ohne Grund und den Vorschaufehler trotz gewähltem Grund. Die Vorschauprüfungen enthalten ausschließlich GET-Aufrufe.
