begin;

-- The concurrent materialized-view refresh can exceed the PostgREST gateway timeout.
-- Run it inside Postgres instead of holding an HTTP request open.
create extension if not exists pg_cron;

create or replace function public.refresh_ltv_cohorts_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
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
  exception when others then
    v_error := pg_catalog.left(sqlerrm, 500);
    insert into public.sync_state (key, value)
    values (
      'ltv_cohorts_materialized',
      pg_catalog.jsonb_build_object('status', 'failed', 'failed_at', pg_catalog.clock_timestamp(), 'error', v_error)
    )
    on conflict (key) do update set value = excluded.value;
    raise;
  end;
end;
$function$;

alter function public.refresh_ltv_cohorts_v1() owner to postgres;
revoke all on function public.refresh_ltv_cohorts_v1() from public, anon, authenticated;
grant execute on function public.refresh_ltv_cohorts_v1() to service_role;

select cron.schedule(
  'wlx-ltv-cohorts-hourly',
  '25 * * * *',
  $cron$select public.refresh_ltv_cohorts_v1();$cron$
);

commit;
