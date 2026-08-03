-- Build the corrected 365-day cohort cache before the short transactional swap.
begin;
set local statement_timeout = '15min';
set local lock_timeout = '5s';
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
drop materialized view if exists private.ltv_cohorts_materialized_next;
create materialized view private.ltv_cohorts_materialized_next as
with registrations as (
  select distinct on (coalesce(affiliate_id, ''), lead_id)
    lead_id,
    coalesce(affiliate_id, '') as affiliate_id,
    coalesce(offer_id, '') as offer_id,
    coalesce(campaign_id, '') as campaign_id,
    converted_at as registered_at,
    date_trunc('month', converted_at)::date as registration_month,
    coalesce(source_id, '') as source_id,
    coalesce(sub_source, '') as sub_source
  from public.conversions
  where type = 'soi'
    and lead_id !~ '^(unjoinable-(sha256|legacy-sha256)|api-customer-unavailable-sha256):[0-9a-f]{64}$'
    and coalesce(status, 'approved') = 'approved'
  order by coalesce(affiliate_id, ''), lead_id, converted_at, id
), lead_values as (
  select
    r.lead_id,
    r.affiliate_id,
    r.offer_id,
    r.campaign_id,
    r.registration_month,
    r.source_id,
    r.sub_source,
    coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '30 days'), 0) as revenue_30d,
    coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '60 days'), 0) as revenue_60d,
    coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '90 days'), 0) as revenue_90d,
    coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '180 days'), 0) as revenue_180d,
    coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '365 days'), 0) as revenue_365d
  from registrations r
  left join public.conversions c
    on c.lead_id = r.lead_id
   and coalesce(c.affiliate_id, '') = r.affiliate_id
   and c.type in ('first_sale', 'rebill')
   and coalesce(c.status, 'approved') = 'approved'
   and c.converted_at >= r.registered_at
   and c.converted_at <= r.registered_at + interval '365 days'
  group by r.lead_id, r.affiliate_id, r.offer_id, r.campaign_id, r.registration_month, r.source_id, r.sub_source
)
select
  registration_month,
  affiliate_id,
  offer_id,
  campaign_id,
  source_id,
  sub_source,
  count(*)::bigint as registrations,
  sum(revenue_30d) as revenue_30d,
  sum(revenue_60d) as revenue_60d,
  sum(revenue_90d) as revenue_90d,
  sum(revenue_180d) as revenue_180d,
  sum(revenue_365d) as revenue_365d
from lead_values
group by registration_month, affiliate_id, offer_id, campaign_id, source_id, sub_source
with data;

create unique index ltv_cohorts_materialized_next_dimensions_uidx
  on private.ltv_cohorts_materialized_next
    (registration_month, affiliate_id, offer_id, campaign_id, source_id, sub_source);
revoke all on private.ltv_cohorts_materialized_next from public, anon, authenticated;
grant usage on schema private to service_role;
grant select on private.ltv_cohorts_materialized_next to service_role;
commit;

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
