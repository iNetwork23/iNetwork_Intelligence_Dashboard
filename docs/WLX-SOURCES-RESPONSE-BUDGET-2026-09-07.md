# Sources: begrenzte Snapshot-Antworten

Produktionsbefund am 7. September 2026: Der reguläre Rollup ab 10:47 UTC meldete Timeouts beim Lesen von Affiliate-Conversions und Source-Snapshots. Der gemeinsame Affiliate-Reader lud bis zu 50 Tagesobjekte pro Anfrage und alle Pakete gleichzeitig. Ein einzelnes Tagesobjekt kann viele Source-Zeilen enthalten.

Der Reader lädt jetzt höchstens acht Objekte pro Anfrage. Er dekodiert jedes Paket vor der nächsten Anfrage und übergibt ein AbortSignal, damit Next keine ungenutzten GET-Antwortkopien im Request-Memo hält. Alle akzeptierten Version-4-Tage bleiben enthalten; Fehler brechen den gesamten Reader weiterhin ab. Die Begrenzung betrifft die Anzahl der Objekte, nicht eine garantierte Bytezahl oder die Größe des abschließenden Ergebnisses.

Zwei neue Regressionen scheiterten vor der Korrektur und bestehen danach: 18 gültige Tage plus ein ausgeschlossener Legacy-Tag werden ohne Lücken oder Duplikate und mit gleichen Summen verarbeitet; ein Timeout im zweiten Paket gibt keine unvollständige Historie zurück und startet keine weiteren Pakete. Der bisherige Quelltexttest, der unbegrenzte parallele Pakete verlangte, wurde durch diese Verhaltensprüfung ersetzt.

Validierung: 198 Testdateien, 1604 Tests erfolgreich; Typecheck und Produktionsbuild erfolgreich; Lint 0 Fehler, eine bestehende Warnung im Sidebar-Test. Abhängigkeiten und Lockfile unverändert; npm audit ohne Schwachstellen.

Der separate Conversion-Abfrageplan wurde erneut lesend geprüft: Affiliate 154, ab 2026-06-10T10:47:00Z, approved/null, Sortierung converted_at/id, Limit 1000. PostgreSQL verwendet weiterhin conversions_converted_at_idx, filtert Affiliate/Status nachträglich und sortiert inkrementell. Die bereits vorbereitete Datei 20260906215000_index_affiliate_conversion_reads.sql wurde nicht angewendet. Dieser Snapshot-Fix belegt keine Lösung der Conversion-Timeouts und keinen vollständigen Rollup.

Die Supabase-Logabfrage für 10:45–11:00 UTC wurde wegen fehlendem Log-Scope abgewiesen; die vorhandene Vercel-Laufzeitevidenz bleibt maßgeblich. Ein lokaler direkter SDK-Read-back startete mangels Service-Key in der lokalen Umgebung keine Datenbankanfrage. Diese Versuche werden nicht als erfolgreiche Produktionsprüfung gewertet.

Die produktive Browserabnahme und der tatsächliche Deployment-SHA werden nach Veröffentlichung in Asana und im Abschlussbericht zurückgelesen. Keine Migration, kein manueller Rollup/Backfill und keine Änderung an Geschäftsdaten gehört zu diesem Codepaket.
