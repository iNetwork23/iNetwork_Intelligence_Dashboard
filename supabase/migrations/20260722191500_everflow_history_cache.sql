-- Everflow history cache for Supabase/Postgres.
-- Run this file once in the Supabase SQL editor.

create table if not exists public.conversions (
  id text primary key,
  type text not null check (type in ('soi', 'first_sale', 'rebill')),
  converted_at timestamptz not null,
  offer_url_id text,
  source_id text,
  sub_source text,
  cost numeric not null default 0,
  revenue numeric not null default 0,
  payout numeric not null default 0,
  lead_id text not null,
  raw jsonb not null,
  status text,
  affiliate_id text,
  affiliate_name text,
  offer_id text,
  offer_name text,
  offer_url_name text,
  campaign_id text,
  campaign_name text,
  synced_at timestamptz not null default now()
);

create index if not exists conversions_converted_at_idx on public.conversions (converted_at);
create index if not exists conversions_source_id_idx on public.conversions (source_id);
create index if not exists conversions_sub_source_idx on public.conversions (sub_source);
create index if not exists conversions_lead_id_idx on public.conversions (lead_id);
create index if not exists conversions_affiliate_id_idx on public.conversions (affiliate_id);
create index if not exists conversions_offer_url_id_idx on public.conversions (offer_url_id);

create table if not exists public.daily_metrics (
  id text primary key,
  metric_date date not null,
  affiliate_id text not null default '0',
  affiliate_name text not null default 'N/A',
  offer_id text not null default '0',
  offer_name text not null default 'N/A',
  campaign_id text not null default '0',
  campaign_name text not null default 'N/A',
  offer_url_id text not null default '0',
  offer_url_name text not null default 'N/A',
  source_id text not null default '',
  sub_source text not null default '',
  clicks numeric not null default 0,
  sois numeric not null default 0,
  first_sales numeric not null default 0,
  rebills numeric not null default 0,
  coin_spend numeric not null default 0,
  payout numeric not null default 0,
  revenue numeric not null default 0,
  profit numeric not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists daily_metrics_date_idx on public.daily_metrics (metric_date);
create index if not exists daily_metrics_affiliate_date_idx on public.daily_metrics (affiliate_id, metric_date);
create index if not exists daily_metrics_campaign_date_idx on public.daily_metrics (campaign_id, metric_date);
create index if not exists daily_metrics_source_date_idx on public.daily_metrics (source_id, sub_source, metric_date);
create index if not exists daily_metrics_offer_url_date_idx on public.daily_metrics (offer_url_id, metric_date);

create table if not exists public.sync_state (
  key text primary key,
  value jsonb not null
);

alter table public.conversions enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.sync_state enable row level security;

-- No RLS policies are intentionally created. Only the server-side service role is used.
revoke all on public.conversions, public.daily_metrics, public.sync_state from anon, authenticated;
grant all on public.conversions, public.daily_metrics, public.sync_state to service_role;

create or replace function public.portfolio_metric_rows(p_from date default null, p_to date default null)
returns table (
  affiliate_id text, affiliate_name text, offer_id text, offer_name text,
  campaign_id text, campaign_name text, offer_url_id text, offer_url_name text,
  clicks numeric, sois numeric, first_sales numeric, rebills numeric, coin_spend numeric,
  payout numeric, revenue numeric, profit numeric
)
language sql stable security invoker set search_path = public as $$
  select affiliate_id, max(affiliate_name), offer_id, max(offer_name), campaign_id, max(campaign_name),
         offer_url_id, max(offer_url_name), sum(clicks), sum(sois), sum(first_sales), sum(rebills),
         sum(coin_spend), sum(payout), sum(revenue), sum(profit)
  from public.daily_metrics
  where (p_from is null or metric_date >= p_from) and (p_to is null or metric_date <= p_to)
  group by affiliate_id, offer_id, campaign_id, offer_url_id;
$$;

create or replace function public.source_metric_rows(p_from date, p_to date, p_affiliate_id text)
returns table (
  affiliate_id text, affiliate_name text, offer_id text, offer_name text,
  campaign_id text, campaign_name text, offer_url_id text, offer_url_name text,
  source_id text, sub_source text, clicks numeric, sois numeric, first_sales numeric,
  rebills numeric, coin_spend numeric, payout numeric, revenue numeric, profit numeric
)
language sql stable security invoker set search_path = public as $$
  select affiliate_id, max(affiliate_name), offer_id, max(offer_name), campaign_id, max(campaign_name),
         offer_url_id, max(offer_url_name), source_id, sub_source, sum(clicks), sum(sois),
         sum(first_sales), sum(rebills), sum(coin_spend), sum(payout), sum(revenue), sum(profit)
  from public.daily_metrics
  where metric_date between p_from and p_to and affiliate_id = p_affiliate_id
  group by affiliate_id, offer_id, campaign_id, offer_url_id, source_id, sub_source;
$$;

create or replace function public.smartlink_metric_rows(p_from date, p_to date, p_campaign_ids text[], p_affiliate_id text default null)
returns table (
  metric_date date, affiliate_id text, affiliate_name text, offer_id text, offer_name text,
  campaign_id text, campaign_name text, offer_url_id text, offer_url_name text,
  clicks numeric, sois numeric, first_sales numeric, rebills numeric, coin_spend numeric,
  payout numeric, revenue numeric, profit numeric
)
language sql stable security invoker set search_path = public as $$
  select metric_date, affiliate_id, max(affiliate_name), offer_id, max(offer_name), campaign_id,
         max(campaign_name), offer_url_id, max(offer_url_name), sum(clicks), sum(sois),
         sum(first_sales), sum(rebills), sum(coin_spend), sum(payout), sum(revenue), sum(profit)
  from public.daily_metrics
  where metric_date between p_from and p_to
    and campaign_id = any(p_campaign_ids)
    and (p_affiliate_id is null or affiliate_id = p_affiliate_id)
  group by metric_date, affiliate_id, offer_id, campaign_id, offer_url_id;
$$;

create or replace view public.ltv_cohorts
with (security_invoker = true) as
with registrations as (
  select distinct on (lead_id)
    lead_id,
    converted_at as registered_at,
    date_trunc('month', converted_at)::date as registration_month,
    coalesce(source_id, '') as source_id,
    coalesce(sub_source, '') as sub_source
  from public.conversions
  where type = 'soi' and coalesce(status, 'approved') = 'approved'
  order by lead_id, converted_at
), lead_values as (
  select r.lead_id, r.registration_month, r.source_id, r.sub_source,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '30 days'), 0) as revenue_30d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '60 days'), 0) as revenue_60d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '90 days'), 0) as revenue_90d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '180 days'), 0) as revenue_180d,
         coalesce(sum(c.revenue) filter (where c.converted_at <= r.registered_at + interval '365 days'), 0) as revenue_365d
  from registrations r
  left join public.conversions c on c.lead_id = r.lead_id
    and c.type in ('first_sale', 'rebill')
    and coalesce(c.status, 'approved') = 'approved'
    and c.converted_at >= r.registered_at
  group by r.lead_id, r.registration_month, r.source_id, r.sub_source
)
select registration_month, source_id, sub_source, count(*)::bigint as registrations,
       sum(revenue_30d) as revenue_30d, sum(revenue_60d) as revenue_60d,
       sum(revenue_90d) as revenue_90d, sum(revenue_180d) as revenue_180d,
       sum(revenue_365d) as revenue_365d
from lead_values
 group by registration_month, source_id, sub_source;

revoke all on public.ltv_cohorts from anon, authenticated;
grant select on public.ltv_cohorts to service_role;
revoke all on function public.portfolio_metric_rows(date,date), public.source_metric_rows(date,date,text), public.smartlink_metric_rows(date,date,text[],text) from public, anon, authenticated;
grant execute on function public.portfolio_metric_rows(date,date), public.source_metric_rows(date,date,text), public.smartlink_metric_rows(date,date,text[],text) to service_role;
