# WLX: authentifizierter Browsernachweis und Zahlenkorrektur

Prüfung vom 7. September 2026, ab 08:32 UTC. Ausgangsrelease: `6db09f9580254e3d5a1fe07d3887e7a734187a0a`, Produktion `dpl_JDi2Wb3pCEUEXBhY9ktPdjQWT4gq`. Der aktuelle Fingerprint nach dem anschließenden Zahlenpaket wird in WLX-000 und im externen Prüfbericht zurückgelesen.

Die Mac-Dashboard-Sitzung ist jetzt als Super Admin verfügbar. Der frühere Unterschied zur iPhone-Sitzung ist damit für diese Prüfung aufgelöst.

- A: Englische Kohortenansicht mit Source-Testfilter und Affiliate 154 öffnet und bleibt nach Reload ohne neue Browserwarnungen oder React-Hydrierungsfehler. Der Reset-Link trägt den geschützten React-Übersetzungsmarker.
- A: Reset navigiert nach `/cohorts`, leert Source, Subsource und Affiliate und zeigt 100 echte Tabellenzeilen. Browser-Zurück stellt den vorherigen Filter mit leerem Ergebnis wieder her; Vorwärts stellt den ungefilterten Stand wieder her.
- A: Alle fünf Filterkontrollen liegen bei gemessenen 390, 768 und 1440 CSS-Pixeln innerhalb des Viewports und sind mindestens 44 Pixel hoch. Die abschließende 1440-Messung wurde gesondert bestätigt; ein früherer, noch nicht umgeschalteter Messwert wurde nicht als Desktopnachweis gezählt.
- A: Der Fraud-Aufruf vom 08:51:44 UTC endet mit einer kontrollierten Fehlerseite. Das zugehörige Vercel-Log nennt einen Supabase-Statement-Timeout beim Lesen der Source-Snapshots. Dieser Aufruf belegt keinen erfolgreichen Fraud-Durchlauf; der frühere Speicherabbruch wird nicht pauschal als gelöst abgenommen.
- B: Für einen repräsentativen aktiven Tagespräfix verwendet PostgreSQL den vorhandenen Primärschlüsselindex. Die Stichprobe enthält 31 Snapshotobjekte, 12467 Source-Zeilen und rund 5,5 MB JSON. Die Ursache des konkreten produktiven Timeouts ist damit noch nicht abschließend reproduziert; kein zusätzlicher Index oder Timeoutwert wurde auf Verdacht angewendet.

## Korrigierte Geldanzeige

A/B: Die englische Startseite zeigte einen Medianvergleich als `56€954.22`. Ursache: Die Umwandlung erkannte bei nicht gruppierten Beträgen nur die letzten drei Ganzzahlstellen. Der Regressionstest reproduziert `56954,22 €` → `56€954.22` vor der Änderung.

Die Währungsumwandlung erkennt nun die vollständige Ganzzahl in beiden Sprachrichtungen. Positive und negative große Beträge sowie vorhandene Gruppierungen bleiben erhalten; finanzielle Berechnungen und Entscheidungsregeln ändern sich dadurch nicht.

Prüfstand des Zahlenpakets: 193 Dateien / 1594 Tests bestanden; zusätzlich gezielte Sprach-/DOM-/Hydrierungstests, Lint, Typecheck, Produktionsbuild, vollständiger Dependency-Audit mit null Befunden und Diffprüfung bestanden. Die reale Kontrolle der korrigierten Anzeige erfolgt nach dem Deployment mit dessen exaktem Commitnachweis.

## Folgepaket: Zeitraumsteuerung nach kaltem Seitenaufruf

Die Geldkorrektur ist auf `f78cd699e9d15b2ebf35db595da1aac2d26cc3fb`, Deployment `dpl_ut92vkJcvgjRfas7XbJfNWYoA2sL`, produktiv bestätigt: Englisch → Deutsch → Englisch erhält komplette Beträge und Vorzeichen. Beim kalten Startseitenaufruf trat daneben um 09:06:17 UTC erneut React #418 auf.

Drei neue verzögerte Hydrierungstests reproduzieren den Konflikt in der globalen, kompakten und Source-Zeitraumsteuerung. Die Komponenten besitzen ihre Texte/Attribute jetzt selbst, mit stabilem anfänglichem Hydrierungssnapshot und anschließendem Localewechsel. Ein gemeinsamer React-Helfer erhält die DOM-Struktur, Events und Refs; er fügt keinen Layoutwrapper hinzu. Fehler werden nicht unterdrückt.

Die Tests bestätigen außerdem Monats-/Jahreswechsel, freie Datumseingaben, Presetnavigation, bestehende Affiliate-Parameter und den Source-Disclosure-Anker. Der bestehende kompakte Feedback-Vertrag bleibt erhalten; seine Source-Strukturprüfung wurde an den expliziten Lokalisierungsaufruf angepasst. Aktueller Prüfstand: 194 Dateien / 1597 Tests, Lint, Typecheck, Build und Audit mit null Befunden bestanden. Der exakte Folge-Commit und seine erneute Liveprüfung werden nach Veröffentlichung in WLX-000 zurückgelesen.

Für Affiliate 154 stimmen auf Seite 1/3/6 jeweils Anzahl, Registrierungssumme, alle fünf Umsatzsummen sowie erste/letzte Gruppenschlüssel zwischen UI und `private.ltv_cohorts_materialized` überein: 100/100/44 Zeilen, 18883/118/113788 Registrierungen; keine fremde Affiliate-ID in diesen 244 sichtbaren Zeilen. Insgesamt: 544 Gruppen und 173597 Registrierungen. Die direkte Abfrage der nicht materialisierten Rohdatenview endete im Statement-Timeout; sie ist ausdrücklich kein bestandener Rohdatenabgleich.

## Folgepaket: verzögert geladene Seitenleiste

Auf `a125d84c159c7c1be17264435cb291da17841795`, Deployment `dpl_2rG9Yqeaib9STj4xAdJbn6PxEq6U`, funktionieren Monats-/Jahreswechsel und freie Datumsfelder produktiv. Beim kalten englischen Startseitenaufruf um 09:20:52 UTC trat aber weiterhin React #418 auf. Dieses Release erhält deshalb keinen allgemeinen Hydrierungs-PASS.

Ein Test der echten verzögert hydrierten AdminSidebar reproduziert die Änderung von `Hauptnavigation`/`ME` zu `Main navigation`/`M.E` vor Reacts Übernahme. Die Seitenleiste, Badges, Designschalter und Logoutbeschriftung verwenden nun ebenfalls den stabilen Hydrierungssnapshot. Navigationslinks verwenden die bereits geschützte Linkkomponente; DOM-Struktur, Berechtigungen, Events und Formular-Ref bleiben erhalten. Markeninitialen und Benutzeridentität sind von der Übersetzung ausgenommen.

Der Regressionstest bestätigt nach der Korrektur DE/EN-Wechsel, unveränderte Linkparameter, Ein-/Ausklappen und Bearbeitungsmodus sowie Designwechsel und Logoutbeschriftung. Es wird kein Logout oder Rollenwechsel ausgelöst. Prüfergebnis: 195 Dateien / 1598 Tests, Lint, Typecheck, Build und Diffprüfung bestanden; unveränderte Dependencies. Der tatsächliche kalte Browserlauf des neuen SHA wird nach Veröffentlichung separat zurückgelesen.

## Folgepaket: gestreamter Startseiteninhalt

Auf `0704fdc51cce24aa9f8a946b3563f4d8f8230471`, Deployment `dpl_3j1qVb2WhoJbCVv9EshjtPafhP53`, sind die geschützte Seitenleiste, Ein-/Ausklappen, Sprachwechsel und unveränderte Markeninitialen produktiv bestätigt. Um 09:27:52 UTC trat beim kalten englischen Startseitenaufruf weiterhin React #418 auf. Der geschützte Seitenleistenbaum allein deckt die gestreamten Serverinhalte nicht ab.

Der neue Regressionstest reproduziert den Konflikt an der servergerenderten Accountüberschrift und den Geldwerten. Die Startseite einschließlich ihrer Fehler-/403-Zweige verwendet jetzt einen React-eigenen lokalisierten Main-Bereich mit stabiler anfänglicher Sprache. Die bestehende Main-DOM-Struktur, Datenladung und serverseitigen Berechtigungen bleiben erhalten. Der Test bestätigt anschließend die englischen Texte und vollständigen Geldbeträge sowie den Rückwechsel nach Deutsch ohne Hydrierungsfehler. Prüfergebnis: 196 Dateien / 1599 Tests, Lint, Typecheck, Build, Audit mit null Befunden und Diffprüfung bestanden. Der neue Live-Nachweis wird nach Veröffentlichung am exakten SHA festgehalten.

Der planmäßige LTV-Refresh ist am 7. September um 09:27 UTC erneut nach zwei Minuten mit `failed / refresh_timeout` beendet worden. Zum Zeitpunkt dieser Beobachtung besaß Job 1 noch den alten Befehl. Nach nachfolgender Nutzerfreigabe wurde ausschließlich dieser Befehl um 09:52:57 UTC korrigiert; [Ausführungsjournal](WLX-FRAUD-MEMORY-LTV-2026-09-07.md).

## Verbleibende Abnahmen

WLX-006 und WLX-011 bleiben offen: Fraud-Laufzeit, vollständige Kohorten-Rohdatenparität, Rollen-/State-/Theme-/Accessibility-Matrix und kontrollierte Stop-/Providerabläufe sind noch nicht vollständig abgenommen. Der Affiliate-Index ist weiterhin nur vorbereitet. Die gesondert genehmigte LTV-Jobkorrektur wurde angewendet; kein manueller Refresh/Backfill und keine Geschäftsdatenmutation wurden ausgelöst. Die gesonderte Freigabegrenze aus Abschnitt 8 des Auftrags bleibt bestehen.
