# Campaign-weite Wirkung und Legacy-Journal im Datenscope

Ausgangsstand: 838c02c2450ecaa796ea75301b198a343a183e85. WLX-004, WLX-007 und WLX-008.

Sieben neue funktionale Routentests reproduzierten zwei Fehler: `/api/automation` gab das gesamte statische Legacy-Journal aus, obwohl gespeicherte Konfigurationen bereits gefiltert wurden; `/api/campaign-status` erlaubte über einen passenden Affiliate-/Campaign-Ausschnitt eine Statusänderung, die alle Affiliates und Redirects der Campaign betrifft.

Das Legacy-Journal filtert jetzt Campaigns nach Affiliate- und Campaign-Scope. Rotationen und Auswertungen ohne eigene Affiliate-ID werden nur bei eindeutig vollständig sichtbarer Campaign-Zuordnung ausgegeben. Unbekannte Campaigns und nicht belegbare Offer-/Account-/Source-/Subsource-Scopes liefern keine historischen Einträge. Unbeschränkte interne Leser behalten das bestehende Journal.

Ein Campaign-PUT darf nur autorisiert werden, wenn die Berechtigung seine vollständige Wirkung abdeckt. Affiliate-, Offer-, Account-, Source- oder Subsource-Beschränkungen autorisieren keinen globalen Campaign-Status oder vollständigen Routingersatz. Ein ausschließlich auf konkrete Campaigns begrenztes Recht bleibt auf diese IDs beschränkt. API und serverseitige Anzeige des Statusschalters verwenden dieselbe Grenze; die Live-Automation prüft sie ebenfalls. Scoped Entwurfs-/Leserechte bleiben erhalten, und die bisherigen zusätzlichen Rollen-/Funktionsrechte bleiben erforderlich.

Nachweise: erlaubter unbeschränkter Journal-Read, eigener und fremder Affiliate-/Campaign-Scope, alle nicht belegbaren Dimensionen, unbekannte und mehrdeutige Historie, 403 vor einem Campaign-Schreibzugriff und vor `live_run`, `activate_live` oder `resume` aus einem zu engen Scope. In Produktion wurde kein Campaign-Status, Routing oder Deal für diese Tests verändert. Die native authentifizierte Rollenmatrix bleibt separat offen, solange die WLX-Anmeldung fehlt.
