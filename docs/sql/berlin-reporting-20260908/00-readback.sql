-- Read-only: before approval, after backup, and after each successful repair window.
select now() checked_at,key,value from public.sync_state
where key in ('everflow_history','fraud_conversion_backfill_v3','fraud_conversion_backfill_berlin_v4','ltv_cohorts_materialized','everflow_history_sync_lock','daily_metrics_replace_lock') order by key;
select c.relname,c.reltuples::bigint estimated_rows,pg_total_relation_size(c.oid) total_bytes
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('conversions','daily_metrics','sync_state');
select count(*) filter(where value->>'version'='5' and value->>'timezoneId'='56') berlin_days,
       count(*) filter(where value->>'version' is distinct from '5' or value->>'timezoneId' is distinct from '56') other_days
from public.sync_state where key like 'portfolio_day_generation:%';
select conname,conrelid::regclass referencing_table,confrelid::regclass referenced_table
from pg_constraint where contype='f' and confrelid in ('public.conversions'::regclass,'public.daily_metrics'::regclass);
