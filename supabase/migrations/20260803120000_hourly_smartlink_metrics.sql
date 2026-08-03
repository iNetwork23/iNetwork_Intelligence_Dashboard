-- Hourly metrics cache for the Smartlink views.
-- Run this file once in the Supabase SQL editor.
--
-- daily_metrics stores one row per calendar day, so the Smartlink view could not
-- resolve anything below a day. Its rolling 24h/72h windows silently degraded to
-- calendar-day boundaries and the hourly chart stayed empty.
--
-- The table intentionally omits source_id and sub_source. The Smartlink views group
-- by offer_url only, and leaving out both high-cardinality dimensions keeps the row
-- count per hour small enough for a 21 day retention window.
--
-- Naming: the database already contains an unrelated public.hourly_metrics table with
-- a hour_start column, written by another system. Everything here is therefore prefixed
-- smartlink_ so both can coexist without either side touching the other.

-- Der Name gehört ausschließlich diesem Projekt, und die Tabelle ist ein reiner Cache,
-- den der Sync innerhalb eines Laufs neu füllt. Das Neuanlegen macht die Datei damit
-- wiederholbar, ohne dass ein abgebrochener Vorlauf einen Zwischenstand hinterlässt.
drop table if exists public.smartlink_hourly_metrics cascade;

create table public.smartlink_hourly_metrics (
  id text primary key,
  metric_hour timestamptz not null,
  affiliate_id text not null default '0',
  affiliate_name text not null default 'N/A',
  offer_id text not null default '0',
  offer_name text not null default 'N/A',
  campaign_id text not null default '0',
  campaign_name text not null default 'N/A',
  offer_url_id text not null default '0',
  offer_url_name text not null default 'N/A',
  clicks numeric not null default 0,
  sois numeric not null default 0,
  first_sales numeric not null default 0,
  rebills numeric not null default 0,
  coin_spend numeric not null default 0,
  payout numeric not null default 0,
  revenue numeric not null default 0,
  profit numeric not null default 0,
  synced_at timestamptz not null default now()
);

create index smartlink_hourly_metrics_hour_idx on public.smartlink_hourly_metrics (metric_hour);
create index smartlink_hourly_metrics_campaign_hour_idx on public.smartlink_hourly_metrics (campaign_id, metric_hour);
create index smartlink_hourly_metrics_affiliate_hour_idx on public.smartlink_hourly_metrics (affiliate_id, metric_hour);

alter table public.smartlink_hourly_metrics enable row level security;

-- No RLS policies are intentionally created. Only the server-side service role is used.
revoke all on public.smartlink_hourly_metrics from anon, authenticated;
grant all on public.smartlink_hourly_metrics to service_role;

create or replace function public.smartlink_hourly_rows(p_from timestamptz, p_to timestamptz, p_campaign_ids text[], p_affiliate_id text default null)
returns table (
  metric_hour timestamptz, affiliate_id text, affiliate_name text, offer_id text, offer_name text,
  campaign_id text, campaign_name text, offer_url_id text, offer_url_name text,
  clicks numeric, sois numeric, first_sales numeric, rebills numeric, coin_spend numeric,
  payout numeric, revenue numeric, profit numeric
)
language sql stable security invoker set search_path = public as $$
  select metric_hour, affiliate_id, max(affiliate_name), offer_id, max(offer_name), campaign_id,
         max(campaign_name), offer_url_id, max(offer_url_name), sum(clicks), sum(sois),
         sum(first_sales), sum(rebills), sum(coin_spend), sum(payout), sum(revenue), sum(profit)
  from public.smartlink_hourly_metrics
  where metric_hour >= p_from and metric_hour <= p_to
    and campaign_id = any(p_campaign_ids)
    and (p_affiliate_id is null or affiliate_id = p_affiliate_id)
  group by metric_hour, affiliate_id, offer_id, campaign_id, offer_url_id;
$$;

-- Retention. The sync calls this after every run so the table stays bounded.
create or replace function public.prune_smartlink_hourly_metrics(p_before timestamptz)
returns bigint
language plpgsql volatile security invoker set search_path = public as $$
declare removed bigint;
begin
  delete from public.smartlink_hourly_metrics where metric_hour < p_before;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.smartlink_hourly_rows(timestamptz,timestamptz,text[],text), public.prune_smartlink_hourly_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.smartlink_hourly_rows(timestamptz,timestamptz,text[],text), public.prune_smartlink_hourly_metrics(timestamptz) to service_role;
