# Watchlist ohne Affiliate-Zuordnung

A: Campaign 3 besitzt im beobachteten 30-Tage-Fenster keine Affiliate-Zuordnung. Der Legacy-Fallback lieferte die Identität `affiliateId=0`. Die Watchlist speicherte diese Nullkennung als Zeichenfolge und erzeugte `/affiliates?affiliate=0&campaign=3`.

B: Die Watchlist behandelt nur positive sichere IDs als Affiliate-Scope. Eine fehlende/Nullkennung wird als kontextloser Smartlink über den vorhandenen `/smartlinks`-Resolver geöffnet. Alte gespeicherte Nullkennungen werden beim Lesen normalisiert; der zugehörige Favorit bleibt entfernbar. Echte gespeicherte Partner bleiben gegenüber dem aktuellen Seitenscope maßgeblich, der Zeitraum bleibt erhalten. Die Legacy-Identitätszeile zeigt bei Nullkennung die fehlende eindeutige Zuordnung; Source-Schreibaktionen werden dafür nicht angeboten.

Verhaltensnachweis mit echter Watchlist-Komponente: neuer kontextloser Favorit, gespeicherter Nullfavorit mit Entfernen sowie echter gespeicherter Affiliate. Vor der Änderung zwei Fehler und ein PASS; danach alle drei PASS. Keine Campaign-, Source- oder andere Provideränderung.

Der produktiv angelegte Testfavorit wird nach der Live-Verifikation über die UI entfernt. Die vollständige Partnerrollen-/Scope-Abnahme von WLX-013 bleibt getrennt.

A/B: Dieselbe leere Campaign enthielt sechs gespeicherte LP-Slots mit Status `deleted`. Der Listenheader bezeichnet sie deshalb neutral als „Landingpages“; die individuellen Status bleiben sichtbar, statt alle sechs fälschlich als aktiv zu bezeichnen.
