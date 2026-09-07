# Verwaltungsseiten mit gespeicherter englischer Sprache

A: Auf Produktion e817280 wurden beim Neuladen von `/settings/deals`, `/admin/access` und `/settings/app` React-418-Hydrierungsfehler beobachtet. Der globale DOM-Übersetzer konnte deutschen Servertext verändern, bevor die betreffende verzögerte React-Grenze hydriert war.

B: Die drei Seiten verwenden jetzt `LocalizedMain` für ihren Serverinhalt. Die nativen Wurzeln von Deal-Formular, Zugriffskonsole (einschließlich ihrer Unteransichten) und App-Installation werden durch `LocalizedRoot` ohne zusätzlichen DOM-Wrapper geschützt und innerhalb von React übersetzt. Der erste Hydrierungsrender bleibt Deutsch; danach wird die gespeicherte Sprache angewendet. Events, Refs, Formularwerte und Providerverträge bleiben erhalten.

Die Regression mit den echten drei Clientkomponenten und verzögerter Suspense-Hydrierung hatte vor der Änderung zwei reproduzierbare Fehler (Zugriffskonsole und Deal-Formular). Nach der Änderung bestehen alle drei Fälle sowie die vorhandenen Account-/Sprachtests. Der App-Fall allein war schon grün; dort schützt zusätzlich die Seitenänderung die Serverüberschrift.

Dies ist eine begrenzte Korrektur der beobachteten Verwaltungsseiten. Die vollständige Sprach-, Rollen-, Geräte- und Fehlerzustandsmatrix bleibt die getrennte Asana-Abnahme WLX-011. Es wurden keine Benutzer, Deals, Push-Abonnements oder Providerdaten geändert.
