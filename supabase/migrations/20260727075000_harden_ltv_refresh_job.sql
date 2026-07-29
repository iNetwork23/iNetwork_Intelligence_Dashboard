begin;

-- The first scheduled refresh exceeded the original four-minute function budget.
-- Keep the timeout local to this maintenance function; no global PostgREST timeout is changed.
create or replace function public.refresh_ltv_cohorts_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '900s'
set lock_timeout = '5s'
as $function$
declare
  v_refreshed_at timestamptz;
  v_error text;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('private.ltv_cohorts_materialized.refresh.v1', 0)) then
    return pg_catalog.jsonb_build_object('status', 'busy');
  end if;

  begin
    refresh materialized view concurrently private.ltv_cohorts_materialized;
    v_refreshed_at := pg_catalog.clock_timestamp();

    insert into public.sync_state (key, value)
    values (
      'ltv_cohorts_materialized',
      pg_catalog.jsonb_build_object('status', 'ready', 'refreshed_at', v_refreshed_at)
    )
    on conflict (key) do update set value = excluded.value;

    return pg_catalog.jsonb_build_object('status', 'refreshed', 'refreshed_at', v_refreshed_at);
  exception
    when query_canceled then
      v_error := 'refresh_timeout';
      insert into public.sync_state (key, value)
      values (
        'ltv_cohorts_materialized',
        pg_catalog.jsonb_build_object('status', 'failed', 'failed_at', pg_catalog.clock_timestamp(), 'error', v_error)
      )
      on conflict (key) do update set value = excluded.value;
      return pg_catalog.jsonb_build_object('status', 'failed', 'error', v_error);
    when others then
      v_error := pg_catalog.left(sqlerrm, 500);
      insert into public.sync_state (key, value)
      values (
        'ltv_cohorts_materialized',
        pg_catalog.jsonb_build_object('status', 'failed', 'failed_at', pg_catalog.clock_timestamp(), 'error', v_error)
      )
      on conflict (key) do update set value = excluded.value;
      return pg_catalog.jsonb_build_object('status', 'failed', 'error', v_error);
  end;
end;
$function$;

alter function public.refresh_ltv_cohorts_v1() owner to postgres;
revoke all on function public.refresh_ltv_cohorts_v1() from public, anon, authenticated;
grant execute on function public.refresh_ltv_cohorts_v1() to service_role;

select cron.schedule(
  'wlx-ltv-cohorts-hourly',
  '25 * * * *',
  $cron$
    set statement_timeout = '15min';
    select public.refresh_ltv_cohorts_v1();
  $cron$
);

-- One self-removing bootstrap run starts on the next minute, so this migration can
-- be verified immediately without holding the SQL editor or an HTTP gateway open.
select cron.schedule(
  'wlx-ltv-cohorts-bootstrap',
  '* * * * *',
  $cron$
    set statement_timeout = '15min';
    select public.refresh_ltv_cohorts_v1();
    select cron.unschedule('wlx-ltv-cohorts-bootstrap');
  $cron$
);

commit;
