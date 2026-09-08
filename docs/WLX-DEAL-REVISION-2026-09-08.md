# Deal-Register: Überschreiben und Ladefehler verhindern

Ausgangspunkt: `a44385b42b79da8f4691de0514fbc5f866efad0e`, Asana WLX-009.

## Bestätigte Fehler und Verhalten

Drei neue Regressionen schlugen auf dem Ausgangsstand fehl: Ein zweiter Bearbeiter konnte denselben geöffneten Stand ohne Konflikt überschreiben (HTTP 200 statt 409); nach Ladefehlern konnten angezeigte Defaults gespeichert werden; „Regel hinzufügen“ ersetzte eine vorhandene Partnerregel ohne ausdrücklichen Bearbeitungsschritt.

Die Verwaltung liest jetzt ungecacht und liefert eine Revision. PUT verlangt `expectedRevision` und vergleicht sie mit dem aktuellen Stand. Die tatsächliche Speicherung ist ebenfalls atomar geschützt: erstes Register per INSERT mit eindeutigem Schlüssel; bestehende Register per UPDATE mit Schlüssel- und Revisionsbedingung. Alte Register ohne Revision werden beim nächsten autorisierten Speichern genau einmal übernommen. Zufällige Revisionen verhindern Kollisionen bei gleichzeitigen Änderungen. Das Format bleibt Version 1, ergänzt um `revision`; eine Migration ist nicht erforderlich.

Die Oberfläche sperrt das Speichern nach einem Ladefehler oder Konflikt. Der Entwurf bleibt beim Konflikt sichtbar, und ein Neulade-Link erklärt den nächsten Schritt. Ein weiterer Klick kann den Konfliktschutz nicht umgehen. Vorhandene Regeln lassen sich weiterhin ausdrücklich bearbeiten. Ein fehlgeschlagener Auditnachweis wird nach erfolgreicher Speicherung als Warnung angezeigt.

Die Verwaltung verweigert beschädigte oder fachlich ungültige gespeicherte Regeln, statt daraus einen speicherbaren Ersatz zu bilden. Der bisherige Engine-Lesepfad und die Sonderdeal-Werte werden durch dieses Paket nicht geändert. Es wurde kein produktiver Deal gespeichert.

## Prüfung

18 zusätzliche Fälle: drei zuvor reproduzierte Fehler; fehlende Revision; beschädigter Bestand; gleichzeitige Erst-, Legacy- und Versionsspeicherung; weitere Änderungen einschließlich leerem Register; bedingter Supabase-HTTP-Request; Datenbankfehler; Entwurfserhalt; neue Revision nach erfolgreicher Speicherung; Auditwarnung und weiterhin erlaubte ausdrückliche Bearbeitung. Der Adaptertest nutzt den echten Supabase-Client mit abgefangenem HTTP-Transport; dies ersetzt keinen produktiven DB-Schreibtest.

Abschließend nach frischem `npm ci`: 220 Testdateien / 1.780 Tests, Typecheck, Produktionsbuild und Diffprüfung bestanden. Vollständiger und Production-Audit melden 0 Schwachstellen. Lint: 0 Fehler und 2 Warnungen — die bestehende unbenutzte Sidebar-Testvariable sowie eine neue Next-Lintwarnung zum vollständigen Seitenwechsel nach Impersonation. Dieser bestehende Seitenwechsel wurde nicht in eine Navigation mit potenziell altem Clientzustand geändert. Der Versionsvertrag wurde auf die verifizierten korrigierten Paketversionen aktualisiert.

## Dependency-Audit

Der aktuelle Audit meldete drei Paketbefunde: Next.js und Vitest/@vitest/mocker. Aktualisiert werden Next.js und eslint-config-next auf 16.3.4 sowie Vitest auf 4.1.11. Paketformat, DB-Schema und Provider-Konfiguration bleiben bestehen.

Primärquellen: [Next.js GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) beschreibt den Windows-spezifischen RCE-Fall; daraus wird keine Ausnutzbarkeit der Vercel-Linux-Laufzeit abgeleitet. [Vitest GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) betrifft Dateilesen über erreichbare Entwicklungsserver und nennt 4.1.11 als korrigiert.

## Vercel-Build nach Framework-Update

Der erste Preview-Build (dpl_8qmiGATFVmx5RmBMYxdasmGEu36b) reproduzierte nach vollständiger Kompilierung einen Next-16.3-Adapterfehler: `ENOENT .next/next-server.js.nft.json` beim Standalone-Abschluss. Lokal ohne Adapter war der Build erfolgreich. `output: standalone` wird deshalb ausschließlich außerhalb von `VERCEL=1` erzeugt; Vercel verwendet seinen eigenen Adapter. Self-Hosting bleibt erhalten. Primärnachweis: Buildlog sowie [Next.js #96646](https://github.com/vercel/next.js/issues/96646). Der anschließende echte Vercel-Build prüft den korrigierten Pfad.

## Grenzen und Rückweg

Der Mac ist gesperrt; native Produktionsabnahme und der bereits vorbereitete SQL-Readback sind offen. Der genaue Deal-Testpartner-Scope für Geschäftsänderungen ist weiterhin nicht freigegeben. Kein Live-Register-/Provider-Schreibtest und kein zusätzlicher unabhängiger Review werden behauptet. WLX-009 bleibt bis zu seinen vollständigen Akzeptanznachweisen offen.

Für einen Code-Rückweg den Änderungssatz revertieren und erneut deployen. Die ergänzende Revision ist für bisherige Engine-Leser unkritisch. Ein Rückweg zur alten ungeschützten PUT-Implementierung würde den Konkurrenzschutz entfernen; daher sollten im Fehlerfall Deal-Schreibzugriffe pausiert und die Korrektur bevorzugt vorwärts repariert werden. Keine produktiven Daten wurden in diesem Arbeitspaket geändert oder müssen zurückgesetzt werden.
