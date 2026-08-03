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
