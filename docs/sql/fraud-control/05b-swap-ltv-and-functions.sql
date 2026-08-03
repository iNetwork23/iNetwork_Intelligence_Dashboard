begin;
set local statement_timeout = '5min';
set local lock_timeout = '5s';
drop function if exists public.refresh_ltv_cohorts_v1();
drop function if exists public.ltv_cohorts_internal_v1(text,text);
drop function if exists public.ltv_cohorts_scoped_v1(text[],text[],text[],text[],text[],text,text);
drop materialized view private.ltv_cohorts_materialized;
alter materialized view private.ltv_cohorts_materialized_next rename to ltv_cohorts_materialized;
revoke all on private.ltv_cohorts_materialized from public, anon, authenticated;
grant select on private.ltv_cohorts_materialized to service_role;

create function public.ltv_cohorts_internal_v1(
  p_source text,
  p_sub_source text
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(to_jsonb(q) order by q.registration_month desc, q.affiliate_id, q.offer_id, q.campaign_id, q.source_id, q.sub_source),
    '[]'::jsonb
  )
  from (
    select m.*
    from private.ltv_cohorts_materialized m
    where (p_source is null or m.source_id = p_source)
      and (p_sub_source is null or m.sub_source = p_sub_source)
  ) q;
$function$;

create function public.ltv_cohorts_scoped_v1(
  p_affiliate_ids text[],
  p_offer_ids text[],
  p_campaign_ids text[],
  p_source_ids text[],
  p_sub_sources text[],
  p_source text,
  p_sub_source text
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(to_jsonb(q) order by q.registration_month desc, q.affiliate_id, q.offer_id, q.campaign_id, q.source_id, q.sub_source),
    '[]'::jsonb
  )
  from (
    select m.*
    from private.ltv_cohorts_materialized m
    where (
      coalesce(cardinality(p_affiliate_ids), 0) > 0
      or coalesce(cardinality(p_offer_ids), 0) > 0
      or coalesce(cardinality(p_campaign_ids), 0) > 0
      or coalesce(cardinality(p_source_ids), 0) > 0
      or coalesce(cardinality(p_sub_sources), 0) > 0
    )
      and (coalesce(cardinality(p_affiliate_ids), 0) = 0 or m.affiliate_id = any(p_affiliate_ids))
      and (coalesce(cardinality(p_offer_ids), 0) = 0 or m.offer_id = any(p_offer_ids))
      and (coalesce(cardinality(p_campaign_ids), 0) = 0 or m.campaign_id = any(p_campaign_ids))
      and (coalesce(cardinality(p_source_ids), 0) = 0 or m.source_id = any(p_source_ids))
      and (coalesce(cardinality(p_sub_sources), 0) = 0 or m.sub_source = any(p_sub_sources))
      and (p_source is null or m.source_id = p_source)
      and (p_sub_source is null or m.sub_source = p_sub_source)
  ) q;
$function$;

revoke all on function public.ltv_cohorts_internal_v1(text, text) from public, anon, authenticated;
revoke all on function public.ltv_cohorts_scoped_v1(text[], text[], text[], text[], text[], text, text) from public, anon, authenticated;
grant execute on function public.ltv_cohorts_internal_v1(text, text) to service_role;
grant execute on function public.ltv_cohorts_scoped_v1(text[], text[], text[], text[], text[], text, text) to service_role;

create function public.refresh_ltv_cohorts_v1()
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
    values ('ltv_cohorts_materialized', pg_catalog.jsonb_build_object('status', 'ready', 'refreshed_at', v_refreshed_at))
    on conflict (key) do update set value = excluded.value;
    return pg_catalog.jsonb_build_object('status', 'refreshed', 'refreshed_at', v_refreshed_at);
  exception
    when query_canceled then
      v_error := 'refresh_timeout';
      insert into public.sync_state (key, value)
      values ('ltv_cohorts_materialized', pg_catalog.jsonb_build_object('status', 'failed', 'failed_at', pg_catalog.clock_timestamp(), 'error', v_error))
      on conflict (key) do update set value = excluded.value;
      return pg_catalog.jsonb_build_object('status', 'failed', 'error', v_error);
    when others then
      v_error := pg_catalog.left(sqlerrm, 500);
      insert into public.sync_state (key, value)
      values ('ltv_cohorts_materialized', pg_catalog.jsonb_build_object('status', 'failed', 'failed_at', pg_catalog.clock_timestamp(), 'error', v_error))
      on conflict (key) do update set value = excluded.value;
      return pg_catalog.jsonb_build_object('status', 'failed', 'error', v_error);
  end;
end;
$function$;

alter function public.refresh_ltv_cohorts_v1() owner to postgres;
revoke all on function public.refresh_ltv_cohorts_v1() from public, anon, authenticated;
grant execute on function public.refresh_ltv_cohorts_v1() to service_role;

commit;
