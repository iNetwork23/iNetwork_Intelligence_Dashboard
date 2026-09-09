# Fester Statusfilter für vorbereitete Conversion-Abfragen

## Beobachtung und Planvergleich

Der Source-Lauf vom 09.09.2026 um 10:30 UTC konnte nach einer Verkleinerung ab Seite 41 die 30-Tage-Reifeauswertung von Affiliate 154 laden. Im folgenden 7-Tage-Lauf schlug jedoch schon die zweite Seite trotz 1000/500/250/125 Zeilen fehl. Der Lauf veröffentlichte beide Teilsnapshots und endete mit HTTP 503 wegen des weiterhin unvollständigen Jahres-Portfolios.

Read-only EXPLAIN auf PostgreSQL 17.6 zeigt den Unterschied: Der generische Plan mit parametrisiertem Status verwendet `conversions_fraud_source_v2_idx` und eine zusätzliche Sortierung, Startkosten 6333,66. Derselbe Plan mit literalem approved/NULL-Filter verwendet `conversions_affiliate_converted_id_approved_idx`, ohne Sortierung und mit Startkosten 0,42. Die Zuordnung des produktiven Timeouts zu diesem Planwechsel ist eine aus Reproduktion und Laufzeitverhalten abgeleitete Ursache; der echte PostgREST-Plan wurde nicht direkt exportiert.

## Eng begrenzte Änderung

Die neue View `public.affiliate_approved_conversions` enthält ausschließlich die bereits gelesenen Spalten id, affiliate_id, converted_at, raw, type und lead_id sowie den festen Filter `status = 'approved' OR status IS NULL`. Sie verwendet `security_invoker = true`. PUBLIC, anon und authenticated erhalten keine Rechte. Die bestehende Service-Rolle erhält ausschließlich SELECT auf die neue View; bestehende Tabellenrechte und RLS bleiben unverändert. Es werden keine Datensätze geschrieben und keine weiteren Indizes angelegt.

Der Anwendungscode verwendet diese View, behält Affiliatefilter, Zeitgrenze, Keyset-Cursor, adaptive Seitengröße, Normalisierung und Fehlerverhalten unverändert. Die korrigierte HTTP-Regression scheiterte am bisherigen Tabellenpfad. Der neue Code darf erst nach bestätigter Migration und anschließendem Schema-/Rechte-Read-back produktiv werden.

## Ausführung und Rückweg

Migration: `supabase/migrations/20260909104000_add_approved_conversion_read_view.sql`. CREATE, Rechtebegrenzung und Schema-Reload-Notify laufen in einer Transaktion. Kein CREATE OR REPLACE: Ein unerwartet vorhandenes Objekt wird nicht überschrieben.

Nach Freigabe und Ausführung: Viewdefinition, security_invoker, ACL und Spalten zurücklesen; generischen Plan auf der View prüfen; erlaubte Mengen für Affiliate 6 und 154 gegen die bisherige approved/NULL-Abfrage abgleichen. Danach geprüften Anwendungscode deployen und einen begrenzten Source-Rollup ausführen.

Rückweg: zuerst die Anwendung auf den vorherigen Produktionscommit `36b394de6c7e5b77f4e079497ca54908259b0acd` zurücksetzen, dann ausschließlich die neue View mit DROP VIEW ohne CASCADE entfernen und den PostgREST-Schemacache neu laden. Die View enthält keine eigenen Daten. Der vorhandene Index und sämtliche Conversions bleiben erhalten. Der SQL-Rückweg liegt in `docs/sql/rollback-approved-conversion-read-view.sql` und der Freigabevorschau und wird nicht vorsorglich produktiv ausgeführt.

Grundlage: [PostgreSQL 17 – generische Pläne](https://www.postgresql.org/docs/17/sql-explain.html) und [partielle Indizes](https://www.postgresql.org/docs/current/indexes-partial.html).

## Prüfung vor der Freigabe

224 Testdateien mit 1815 Tests bestanden. Lint: null Fehler und zwei bereits bestehende Warnungen. TypeScript, Produktionsbuild und git diff --check erfolgreich. README und Migrationsinventar enthalten die neue Datei und die zwingende Reihenfolge Migration/Read-back vor App-Deployment. Ein produktiver Erfolg dieser Änderung wird erst nach Freigabe, Ausführung und anschließendem Read-back behauptet.
