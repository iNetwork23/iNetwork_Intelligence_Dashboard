# WLX: Datenbank-Read-back und Freigabegrenzen

Stand: 2026-09-06. Ausschließlich lesender Supabase-/Vercel-MCP-Abgleich. A = produktiv beobachtet, B = durch Provider/Code/Tests bestätigt, D = ausstehende Prüfung. Kein SQL-Backfill, Refresh oder Indexaufbau wurde ausgelöst.

## Bestätigter Objektstand

- Alle öffentlichen Basistabellen haben RLS; Tabellen, LTV-View und öffentliche RPCs besitzen keine direkten `anon`-/`authenticated`-Freigaben. Der interne Serverzugriff erfolgt über `service_role` und die Anwendungsautorisierung. Die Advisor-Information „RLS ohne Policy“ rechtfertigt hier keine pauschale Öffnung.
- Fraud-Tabelle, die drei `conversions_fraud_*_v2_idx`-Indizes, `manage_fraud_stop`, Identitäts-Trigger/Reparaturfunktion, atomare Conversion-/Metric-Replacement-RPCs, private LTV-Materialisierung und scoped/internal LTV-Lese-RPCs sind vorhanden. Alle gelesenen Indizes sind ready/valid.
- Der Nonempty-Identitätsconstraint ist validiert. Die aggregierte Prüfung auf leere `lead_id` und Raw-Keys `adv4`/`email` ergab keine verbleibenden Treffer.
- `replace_metric_window(date,date,jsonb)` stimmt mit der versionierten Vertragsprüfung überein; Timeout 240 s und Locktimeout 5 s sind gesetzt.
- Die Supabase-Migrationshistorie ist leer. Das bedeutet keine fehlenden Objekte und erlaubt kein erneutes Ausführen sämtlicher historischer Migrationen. Der Objektstand muss jeweils separat abgeglichen werden.
- Die normalisierten `app_*`-Tabellen existieren. Der aktuelle Anwendungscode liest Rollen aus `auth.users.app_metadata` und Sitzungen/Rollenobjekte aus `sync_state` über `access-store`; leere normalisierte Rollenzuordnungen sind daher kein Beleg für einen defekten Login.

## Offene Daten- und Betriebsgates

- History steht im Backfill; der tägliche Sync meldet wiederholt `metric replacement row outside contract`. Der SQL-Vertrag ist vorhanden. Die konkrete ungültige Providerzeile ist noch nicht reproduziert; der Vertrag darf nicht gelockert werden.
- Fraud-v3 steht im Backfill ohne bestätigte Parität. Kein Cutover freigegeben. Die Pagination meldet eine Abweichung zwischen eindeutigen Conversions und Provider-total_count; unvollständige Ergebnisse bleiben abgewiesen.
- Die letzte LTV-Aktualisierung meldet `failed / refresh_timeout`. Vorhandene materialisierte Werte beweisen keine Aktualität oder Parität.
- Vercel meldet wiederholte Timeouts beim Lesen von Affiliate-Conversions und Source-Snapshots. Der Conversion-Queryplan nutzt einen zeitbasierten Index und filtert den Affiliate nachträglich; ein passender kombinierter Index fehlt.
- Supabase-Advisors: `scrub_raw_customer_identities_batch_v1()` besitzt keinen festen Search Path, ist aber Invoker und nur `postgres` darf sie ausführen. Zusätzlich ist Leaked-Password-Protection deaktiviert. Diese Konfigurationsänderungen wurden nicht ausgeführt.
- Preview ist gebaut und `READY`, besitzt laut Runtimefehler aber keine vollständige Supabase-Konfiguration. Ein erfolgreicher Build belegt hier keine funktionsfähige Datenanbindung. Der Vercel-UI-Read-back bestätigt: alle 13 vorhandenen Variablen sind ausschließlich Production zugeordnet, darunter Supabase-, Everflow- und Session-Konfiguration. Namen und Zielumgebungen wurden gelesen, keine Werte aufgedeckt.

## Vorbereitete Indexänderung – noch nicht ausgeführt

Datei: `supabase/migrations/20260906215000_index_affiliate_conversion_reads.sql`.

Exakter Scope: ein zusätzlicher partieller B-Tree-Index auf `public.conversions (affiliate_id, converted_at, id)` für `status = 'approved' OR status IS NULL`. Keine Datenzeile, Policy, Rolle oder Funktion wird geändert. Ziel: den Querypfad von `loadAffiliateConversionsFromCache` ohne nachträglichen accountweiten Affiliatefilter und Sortierung bedienen. Beschleunigung ist erst nach einem echten Plan-/Laufzeitvergleich belegt.

Vor einer Freigabe:

1. Aktuellen Backup/PITR- und freien Speicherstatus bestätigen.
2. Unmittelbar vor der Ausführung den Indexnamen und laufende Builds prüfen:

   ```sql
   select to_regclass('public.conversions_affiliate_converted_id_approved_idx');
   select relid::regclass, index_relid::regclass, phase from pg_stat_progress_create_index;
   ```

3. Einen bestätigten Autocommit-Kanal wählen. Die Datei darf nicht innerhalb einer Migrationstransaktion oder eines gemeinsamen SQL-Editor-Blocks ausgeführt werden. Bei SQLSTATE 25001 stoppen und den Zustand lesen; kein Ersatz durch einen blockierenden Indexaufbau.
4. Nach expliziter Freigabe exakt diese eine Datei ausführen.
5. Den tatsächlichen Index zurücklesen:

   ```sql
   select c.relname, i.indisready, i.indisvalid, pg_get_indexdef(c.oid)
   from pg_class c join pg_index i on i.indexrelid=c.oid
   where c.oid=to_regclass('public.conversions_affiliate_converted_id_approved_idx');
   ```

6. Den vorhandenen lesenden Conversion-Queryplan für denselben Affiliate und dasselbe Fenster vergleichen; anschließend genau einen kontrollierten Rollup-/Reife-Read-back prüfen. Kein Backfill automatisch mitstarten.

Rollback nach separater Zustandsprüfung: nur den neu angelegten Index per `DROP INDEX CONCURRENTLY public.conversions_affiliate_converted_id_approved_idx` entfernen, ebenfalls außerhalb einer Transaktion. Nach einem abgebrochenen Aufbau `indisvalid` prüfen; `IF NOT EXISTS` repariert keinen ungültigen vorhandenen Index.

## Anwendungsfehler aus dem Read-back

- Der LTV-RPC kann HTTP-erfolgreich `{status:'failed'}` zurückgeben. Der bisherige Wrapper machte daraus `ready`; die Korrektur akzeptiert ausschließlich `status:'refreshed'` und übernimmt dessen tatsächlichen Zeitstempel.
- Zugewiesene interne Scopes wurden von mehreren Lesehelfern ignoriert. Die Korrektur filtert Portfolio-, Source-, Rebill- und Kohorten-Daten vor der Ausgabe/Aggregation. Nicht auswertbare Scopes bleiben gesperrt; Partner ohne Scope bleiben ohne Daten. Der Cache-Fingerprint wird versioniert, damit alte unbeschränkte Ergebnisse nicht wiederverwendet werden.
- Der Kohorten-API-Fehlerpfad gab interne Datenbankdetails aus. Die Antwort wird vereinheitlicht; 403 und die Finanzberechtigung bleiben eigenständige Grenzen.

Die zugehörigen Regressionen wurden zunächst auf dem alten Verhalten rot ausgeführt. Dies ersetzt weder die angemeldete Rollenmatrix noch die Produktionsfreigabe. Die übrigen administrativen/providerseitigen Abläufe bleiben nach dem Hauptauftrag an konkrete Testscopes gebunden.
