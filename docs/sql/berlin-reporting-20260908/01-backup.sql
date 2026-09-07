-- PREPARED ONLY. Run once, after explicit production scope approval.
-- Pause Vercel traffic/crons and wait for current writers to finish first.
-- This backup is private, contains no new provider credentials, and is never exposed by PostgREST.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '10min';
lock table public.conversions, public.daily_metrics, public.sync_state in share row exclusive mode;
create schema wlx_berlin_backup_20260908;
revoke all on schema wlx_berlin_backup_20260908 from public, anon, authenticated, service_role;
create table wlx_berlin_backup_20260908.conversions as table public.conversions;
create table wlx_berlin_backup_20260908.daily_metrics as table public.daily_metrics;
create table wlx_berlin_backup_20260908.sync_state as table public.sync_state;
create table wlx_berlin_backup_20260908.manifest as
select clock_timestamp() captured_at,
       (select count(*) from public.conversions) conversion_rows,
       (select count(*) from public.daily_metrics) metric_rows,
       (select count(*) from public.sync_state) state_rows,
       'c5d9c70ad68949c7b82b1c0b55ff3f58bc34155d'::text baseline_commit;
alter table wlx_berlin_backup_20260908.manifest
 alter column captured_at set not null,
 alter column baseline_commit set not null,
 alter column conversion_rows set not null,
 alter column metric_rows set not null,
 alter column state_rows set not null,
 add check(conversion_rows>=0 and metric_rows>=0 and state_rows>=0),
 add check(baseline_commit='c5d9c70ad68949c7b82b1c0b55ff3f58bc34155d');
-- Central whitelist deliberately excludes users, sessions, roles, deals, campaign configs and provider rules.
create function wlx_berlin_backup_20260908.is_reporting_key(k text) returns boolean
language sql immutable strict set search_path = pg_catalog as $body$
select k in ('everflow_history','fraud_conversion_backfill_v3','fraud_conversion_backfill_berlin_v4')
 or k ~ '^(source_day:|source_day_generation:|portfolio_day:|portfolio_day_generation:|campaign_affiliate_day:|campaign_affiliate_day_generation:|portfolio_range:|portfolio_range_generation:|rebill_day[^:]*:|source_candidates:|lead_maturity:|source_activity_memo:|smartlink_activity_memo:)';
$body$;
revoke all on all tables in schema wlx_berlin_backup_20260908 from public, anon, authenticated, service_role;
revoke all on all functions in schema wlx_berlin_backup_20260908 from public, anon, authenticated, service_role;
do $verify$
begin
 if exists(select 1 from wlx_berlin_backup_20260908.manifest m where
 m.conversion_rows is distinct from (select count(*) from wlx_berlin_backup_20260908.conversions) or
 m.metric_rows is distinct from (select count(*) from wlx_berlin_backup_20260908.daily_metrics) or
 m.state_rows is distinct from (select count(*) from wlx_berlin_backup_20260908.sync_state)) then
  raise exception 'backup row count mismatch';
 end if;
end;
$verify$;
commit;
select * from wlx_berlin_backup_20260908.manifest;
