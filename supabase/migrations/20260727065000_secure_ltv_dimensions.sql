begin;

drop view if exists public.ltv_cohorts;

create view public.ltv_cohorts
with (security_invoker = true) as
with registrations as (
  select distinct on (affiliate_id, lead_id)
    lead_id,
    affiliate_id,
    coalesce(offer_id, '') as offer_id,
    coalesce(campaign_id, '') as campaign_id,
    converted_at as registered_at,
    date_trunc('month', converted_at)::date as registration_month,
    coalesce(source_id, '') as source_id,
    coalesce(sub_source, '') as sub_source
  from public.conversions
  where type = 'soi' and coalesce(status, 'approved') = 'approved'
  order by affiliate_id, lead_id, converted_at
), lead_values as (
  select r.lead_id, r.affiliate_id, r.offer_id, r.campaign_id, r.registration_month, r.source_id, r.sub_source,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '30 days'), 0) as revenue_30d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '60 days'), 0) as revenue_60d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '90 days'), 0) as revenue_90d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '180 days'), 0) as revenue_180d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '365 days'), 0) as revenue_365d
  from registrations r
  left join public.conversions c on c.lead_id = r.lead_id
    and c.affiliate_id = r.affiliate_id
    and c.type in ('first_sale', 'rebill')
    and coalesce(c.status, 'approved') = 'approved'
    and c.converted_at >= r.registered_at
  group by r.lead_id, r.affiliate_id, r.offer_id, r.campaign_id, r.registration_month, r.source_id, r.sub_source
)
select registration_month, affiliate_id, offer_id, campaign_id, source_id, sub_source, count(*)::bigint as registrations,
       sum(revenue_30d) as revenue_30d, sum(revenue_60d) as revenue_60d,
       sum(revenue_90d) as revenue_90d, sum(revenue_180d) as revenue_180d,
       sum(revenue_365d) as revenue_365d
from lead_values
group by registration_month, affiliate_id, offer_id, campaign_id, source_id, sub_source;

revoke all on public.ltv_cohorts from anon, authenticated;
grant select on public.ltv_cohorts to service_role;

commit;