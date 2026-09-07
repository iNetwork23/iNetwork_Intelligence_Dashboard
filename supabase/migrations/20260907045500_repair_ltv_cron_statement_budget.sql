begin;

-- Production read-back: function budget 900s, but the outer hourly statement
-- starts with 120s and is canceled at 120s. Set the budget before that statement.
-- Changes only the existing named hourly job; no immediate refresh or backfill.
do $migration$
declare
  v_jobid bigint;
  v_command text;
begin
  select jobid, command into strict v_jobid, v_command
  from cron.job where jobname = 'wlx-ltv-cohorts-hourly' for update;
  if btrim(v_command) <> 'select public.refresh_ltv_cohorts_v1();' then
    raise exception 'LTV hourly command changed since preview; review before applying';
  end if;
  perform cron.alter_job(v_jobid, command := $job$set statement_timeout = '15min';
select public.refresh_ltv_cohorts_v1();$job$);
end;
$migration$;

commit;
