# Fraud-Control-Migration und Cutover

Status: ausführbare Produktionsanleitung; noch nicht gegen Produktion ausgeführt.

## Sicherheitsgrenzen

- Die Operator-Dateien und anschließend die Migrationen **einzeln und in der angegebenen Reihenfolge** im Supabase SQL Editor ausführen.
- `01a-fraud-schema.sql` enthält den transaktionalen Schemaanteil. Die drei Dateien `01b` bis `01d` enthalten jeweils genau einen Online-Indexaufbau und dürfen niemals in einen gemeinsamen `BEGIN … COMMIT`-Block oder eine gemeinsame SQL-Editor-Ausführung eingebettet werden.
- Falls der SQL Editor bei einer einzelnen `CREATE INDEX CONCURRENTLY`-Datei `ERROR 25001` meldet, **nicht wiederholen und nicht auf einen blockierenden normalen Index ausweichen**. Zuerst den unbekannten Ausführungszustand per Read-back prüfen und einen bestätigten nicht-transaktionalen DDL-Kanal beziehungsweise ein Wartungsfenster festlegen.
- Vorher aktuellen Datenbank-Backup-/PITR-Status prüfen.
- Während der Migration und des Backfills bleibt der Automation-Journal-Cron pausiert.
- Der Fraud-Screen bleibt bis zur nachgewiesenen Parität im Shadow Mode. Er löst keine Everflow-, Payout-, Postback- oder Source-Änderung aus.
- SQL-Ergebnisse ohne Credential-, Connection-String- oder Tokenwerte dokumentieren.

## Schritt 1 – Fraud-Schema und server-only Stop-Protokoll

Dateien – jede einzeln und exakt in dieser Reihenfolge:

1. `docs/sql/fraud-control/01a-fraud-schema.sql`
2. `docs/sql/fraud-control/01b-source-index.sql`
3. `docs/sql/fraud-control/01c-cohort-index.sql`
4. `docs/sql/fraud-control/01d-timing-index.sql`

Die kanonische Migration `supabase/migrations/20260730235022_account_wide_fraud_control.sql` enthält dieselben Schema- und Indexdefinitionen, ist wegen der gemischten Transaktionsanforderungen aber **nicht** das SQL-Editor-Operatorartefakt.

Danach ausführen:

```sql
select
  to_regclass('public.fraud_stop_requests') is not null as stop_table_exists,
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.conversions'::regclass
      and attname = 'traffic_mode' and not attisdropped
  ) as traffic_mode_exists,
  exists (
    select 1 from pg_attribute
    where attrelid = 'public.conversions'::regclass
      and attname = 'is_scrub' and not attisdropped
  ) as scrub_flag_exists;

select
  indexname,
  indexdef,
  i.indisready,
  i.indisvalid
from pg_indexes x
join pg_class c on c.relname = x.indexname
join pg_index i on i.indexrelid = c.oid
where x.schemaname = 'public'
  and x.indexname in (
    'conversions_fraud_source_v2_idx',
    'conversions_fraud_cohort_v2_idx',
    'conversions_fraud_timing_v2_idx'
  )
order by indexname;
```

Erwartung: drei `true`-Werte, alle drei Indizes, die erwarteten Definitionen sowie für jeden Index `indisready = true` und `indisvalid = true`. Ein vorhandener, aber ungültiger Concurrent-Index ist **kein** Erfolg und muss vor einem kontrollierten Retry separat bereinigt werden.

## Schritt 2 – atomare Auditspur für dokumentierte Partner-Stops

Datei:

`supabase/migrations/20260731004258_harden_fraud_stop_atomicity.sql`

Read-back:

```sql
select
  to_regprocedure('public.manage_fraud_stop(text,jsonb,jsonb)') is not null
    as manage_fraud_stop_exists,
  to_regclass('public.fraud_stop_requests_active_identity_uidx') is not null
    as active_identity_index_exists;
```

Erwartung: beide Werte `true`.

Hinweis: Diese Stop-Einträge dokumentieren eine Partnerabmeldung. Sie sind **keine** technische Everflow-Source-Sperre.

## Schritt 3 – Kundenidentitäten und Raw-PII resumierbar härten

Zuerst genau einmal ausführen:

`supabase/migrations/20260731080000_harden_conversion_customer_identity.sql`

Diese Datei installiert zuerst einen Write-Time-Trigger, der `raw.adv4` und `raw.email` bei jedem neuen oder geänderten Datensatz entfernt. Sie legt außerdem die begrenzte, `SKIP LOCKED`-fähige Reparaturfunktion an und fügt den Nonempty-Constraint zunächst `NOT VALID` hinzu. Sie führt bewusst **keinen** unbeschränkten Tabellen-Update in einer Browsertransaktion aus.

Danach folgenden Batch einzeln wiederholen, bis er `0` zurückgibt:

```sql
select public.repair_conversion_identity_batch(5000) as repaired_rows;
```

Nach jedem Batch darf bei Abbruch einfach anhand der Read-backs weitergearbeitet werden. Erst nach `repaired_rows = 0` prüfen:

```sql
select
  count(*) filter (where btrim(coalesce(lead_id, '')) = '') as empty_customer_ids,
  count(*) filter (where coalesce(raw, '{}'::jsonb) ? 'adv4') as raw_adv4_remaining,
  count(*) filter (where coalesce(raw, '{}'::jsonb) ? 'email') as raw_email_remaining,
  count(*) filter (
    where lead_id ~ '^(unjoinable-(sha256|legacy-sha256)|api-customer-sha256):[0-9a-f]{64}$'
  ) as pseudonymous_or_unjoinable_ids
from public.conversions;
```

Erwartung: `empty_customer_ids = 0`, `raw_adv4_remaining = 0` und `raw_email_remaining = 0`. Erst dann den Constraint in einer **separaten** SQL-Editor-Ausführung validieren:

```sql
set statement_timeout = '15min';
alter table public.conversions
  validate constraint conversions_lead_id_nonempty_check;
```

Finaler Read-back:

```sql
select
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.conversions'::regclass
  and conname = 'conversions_lead_id_nonempty_check';

select
  p.proname,
  p.prosecdef,
  p.proconfig,
  pg_get_userbyid(p.proowner) as owner,
  p.proacl
from pg_proc p
where p.oid in (
  'public.strip_conversion_raw_identity()'::regprocedure,
  'public.repair_conversion_identity_batch(integer)'::regprocedure
);
```

Erwartung: `convalidated = true`, die erwartete Nonempty-Definition, Triggerfunktion als Invoker und Reparaturfunktion als Definer mit fixiertem Search Path und ohne Execute-Rechte für `public`, `anon` oder `authenticated`.

## Schritt 4 – atomarer Conversion-Fensterersatz

Datei:

`supabase/migrations/20260731090000_atomic_conversion_window_replacement.sql`

Read-back:

```sql
select
  to_regprocedure('public.replace_conversion_window(date,date,jsonb)') is not null
    as replace_conversion_window_exists;
```

Erwartung: `true`.

Die Funktion akzeptiert höchstens sieben Kalendertage und 50.000 Zeilen. Löschen und Einfügen erfolgen in derselben Datenbanktransaktion.

## Schritt 5 – LTV ohne nicht joinbare Identitäten neu aufbauen

Die kanonische Migration enthält Build und Swap, ist aber **nicht** das SQL-Editor-Operatorartefakt. Im SQL Editor einzeln ausführen:

1. `docs/sql/fraud-control/05a-build-ltv-next.sql` – baut die 365-Tage-Next-View; darf länger laufen.
2. Vor dem Swap die Next-View prüfen:

```sql
select
  to_regclass('private.ltv_cohorts_materialized_next') is not null as next_exists,
  count(*) as next_rows
from private.ltv_cohorts_materialized_next;
```

3. `docs/sql/fraud-control/05b-swap-ltv-and-functions.sql` – kurzer transaktionaler Swap plus gehärtete Funktionen.
4. `docs/sql/fraud-control/05c-refresh-and-readback.sql` – expliziter Refresh und Sync-State-Read-back.

Finaler Read-back:

```sql
select
  to_regclass('private.ltv_cohorts_materialized') is not null
    as ltv_cache_exists,
  to_regprocedure('public.refresh_ltv_cohorts_v1()') is not null
    as refresh_function_exists;

select value
from public.sync_state
where key = 'ltv_cohorts_materialized';
```

Erwartung: beide Werte `true`. Der Sync-State muss nach einem erfolgreichen Refresh `status = ready` oder `status = refreshed` ausweisen.

## Deployment-Reihenfolge

1. Alle Operator-SQLs und Read-backs erfolgreich abschließen.
2. Den unveränderlichen, vollständig geprüften Releasecommit als **nicht kanonische, unaliasierte Dark-/Preview-Deploymentinstanz** mit dem kontrollierten Produktions-Datenbankzugang bereitstellen. Die öffentliche Produktions-URL darf dabei noch nicht auf den Kandidaten zeigen.
3. Healthcheck und anonymen 401-/Login-Grenztest gegen diese unveränderliche Instanz durchführen.
4. Fraud-Backfill ausschließlich über diese kontrollierte Instanz unter dem gemeinsamen History-Sync-Lock starten. Ein ungescopter Super-Admin mit `api.manage`, `statistics.view` und `finance.view` sendet den CSRF-geschützten `POST /api/sync?refresh=fraud-backfill`; der öffentliche Produktions-Cron ist dafür noch nicht freigegeben.
5. Backfill wiederholen, bis der Rückgabestatus `phase = rolling` und `ready = true` meldet.
6. `sync_state.key = 'fraud_conversion_backfill_v3'` lesen und die unten genannten Paritätsbedingungen bestätigen.
7. Erst nach erfolgreicher Parität einen neuen unabhängigen Review des unveränderten Commit-/Deploymentfingerprints abschließen.
8. Nur bei terminalem PASS die bereits geprüfte immutable Deploymentinstanz auf den kanonischen Produktionsalias promoten. Kein Neubuild zwischen Parität, Review und Promotion.

```sql
select
  value->>'phase' as phase,
  value->>'coveredFrom' as covered_from,
  value->>'coveredThrough' as covered_through,
  value->>'parityVerifiedThrough' as parity_verified_through,
  value->>'readyAt' as ready_at,
  value->'lastParity'->>'verified' as last_parity_verified
from public.sync_state
where key = 'fraud_conversion_backfill_v3';
```

Erwartung:

- `phase = rolling`;
- `covered_from` ist gesetzt;
- `covered_through = parity_verified_through`;
- `ready_at` ist gesetzt;
- `last_parity_verified = true`.

## Produktionsabnahme

Erst nach vollständigem Cutover:

- Fraud-Seite als ungescopter Super-Admin auf Desktop und 390×844 Mobil öffnen;
- 7-, 30- und 90-Tage-Filter prüfen;
- Smartlink, Direct und clickless API getrennt sichtbar;
- Affiliate-, Offer-, Campaign-, Source- und Subsource-Dimensionen prüfen;
- Top-1-/Top-2-Rebillkonzentration nur bei verlässlicher Kundenidentität anzeigen;
- unvollständige v3-Source-Coverage muss fail-closed warnen;
- gescopte Super-Admins, Admins, Employees und Partner müssen 403 erhalten;
- `writesPerformed = 0` und Shadow Mode sichtbar;
- keine Everflow-Source-Mutation durch Fraud-Aktionen;
- Console-, Netzwerk- und Renderingfehler prüfen.

## Rollback

- Applikationsrollback auf den vorherigen Releasecommit ist unabhängig von den additiven Spalten möglich.
- Die neuen Spalten/Tabellen nicht während eines Incident hektisch löschen; der alte Code ignoriert sie.
- Fraud-Backfill durch Pausieren des Sync-Aufrufs stoppen. Der atomare Fensterersatz hinterlässt keine halb ersetzten Fenster.
- Bei einer fehlerhaften LTV-Neuberechnung den Produktionsrelease nicht freigeben und den Datenbankzustand anhand PITR/Backup und Migrationsergebnis untersuchen.
