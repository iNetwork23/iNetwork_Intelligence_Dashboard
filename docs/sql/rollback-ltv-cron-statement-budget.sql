-- Execute only after checking that no repair is still required and reading the current job.
begin;
do $rollback$
declare
  v_jobid bigint;
  v_command text;
begin
  perform pg_advisory_xact_lock(hashtextextended('wlx-ltv-cohorts-hourly-command', 0));
  select jobid, command into strict v_jobid, v_command
  from cron.job where jobname = 'wlx-ltv-cohorts-hourly';
  if btrim(v_command) <> E'set statement_timeout = ''15min'';\nselect public.refresh_ltv_cohorts_v1();' then
    raise exception 'LTV hourly command changed; review rollback scope';
  end if;
  perform cron.alter_job(v_jobid, command := 'select public.refresh_ltv_cohorts_v1();');
end;
$rollback$;
commit;
