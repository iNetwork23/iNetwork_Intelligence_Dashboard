-- PREPARED ONLY. Restores a reviewed backup; do not run as a routine deployment step.
-- Requires a CURRENT scope approval, Vercel traffic/crons paused and no other reporting writer.
-- Rewinds imported events/metrics to captured_at. Later imports must be replayed from Everflow.
-- Read manifest and current row counts before approval. No CASCADE; unexpected FK fails closed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15min';
lock table public.conversions, public.daily_metrics, public.sync_state in access exclusive mode;
do $verify$
begin
 if (select count(*) from wlx_berlin_backup_20260908.manifest)<>1 then
  raise exception 'missing or ambiguous backup manifest';
 end if;
 if exists(select 1 from wlx_berlin_backup_20260908.manifest m where
 m.baseline_commit is distinct from 'c5d9c70ad68949c7b82b1c0b55ff3f58bc34155d' or
 m.captured_at is null or m.captured_at>clock_timestamp() or not isfinite(m.captured_at) or
 m.conversion_rows is distinct from (select count(*) from wlx_berlin_backup_20260908.conversions) or
 m.metric_rows is distinct from (select count(*) from wlx_berlin_backup_20260908.daily_metrics) or
 m.state_rows is distinct from (select count(*) from wlx_berlin_backup_20260908.sync_state)) then
  raise exception 'backup row count mismatch';
 end if;
end;
$verify$;
truncate public.conversions, public.daily_metrics;
insert into public.conversions select * from wlx_berlin_backup_20260908.conversions;
insert into public.daily_metrics select * from wlx_berlin_backup_20260908.daily_metrics;
delete from public.sync_state where wlx_berlin_backup_20260908.is_reporting_key(key);
insert into public.sync_state select * from wlx_berlin_backup_20260908.sync_state
where wlx_berlin_backup_20260908.is_reporting_key(key);
-- The materialized LTV view must be refreshed from the restored events before reopening traffic.
insert into public.sync_state(key,value) values('ltv_cohorts_materialized',jsonb_build_object('status','failed','error','reporting_restore_requires_ltv_refresh','failed_at',clock_timestamp()))
on conflict(key) do update set value=excluded.value;
commit;
select (select count(*) from public.conversions) conversion_rows,
       (select count(*) from public.daily_metrics) metric_rows,
       (select count(*) from public.sync_state where wlx_berlin_backup_20260908.is_reporting_key(key)) reporting_state_rows;
-- Next separately: SELECT public.refresh_ltv_cohorts_v1(); verify status=ready and refreshed_at.
-- Restore the reviewed baseline deployment and expire reporting caches before reopening traffic.
