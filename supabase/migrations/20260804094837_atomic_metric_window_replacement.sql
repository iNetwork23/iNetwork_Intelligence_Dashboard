begin;
set local lock_timeout = '5s';
set local statement_timeout = '5min';

create or replace function public.replace_metric_window(
  p_from date,
  p_to date,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 2 then
    raise exception 'invalid metric replacement window';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 50000 then
    raise exception 'invalid metric replacement payload';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as x(
      id text, metric_date date, affiliate_id text, offer_id text,
      campaign_id text, offer_url_id text
    )
    where nullif(btrim(x.id::text),'') is null
       or nullif(btrim(x.metric_date::text),'') is null
       or nullif(btrim(x.affiliate_id::text),'') is null
       or nullif(btrim(x.offer_id::text),'') is null
       or nullif(btrim(x.campaign_id::text),'') is null
       or nullif(btrim(x.offer_url_id::text),'') is null
       or x.metric_date not between p_from and p_to
  ) then
    raise exception 'metric replacement row outside contract';
  end if;

  delete from public.daily_metrics
  where metric_date between p_from and p_to;

  insert into public.daily_metrics (
    id, metric_date, affiliate_id, affiliate_name, offer_id, offer_name,
    campaign_id, campaign_name, offer_url_id, offer_url_name, source_id,
    sub_source, clicks, sois, first_sales, rebills, coin_spend, payout,
    revenue, profit, raw
  )
  select
    x.id, x.metric_date, x.affiliate_id, coalesce(x.affiliate_name,'N/A'),
    x.offer_id, coalesce(x.offer_name,'N/A'), x.campaign_id,
    coalesce(x.campaign_name,'N/A'), x.offer_url_id,
    coalesce(x.offer_url_name,'N/A'), coalesce(x.source_id,''),
    coalesce(x.sub_source,''), coalesce(x.clicks,0), coalesce(x.sois,0),
    coalesce(x.first_sales,0), coalesce(x.rebills,0),
    coalesce(x.coin_spend,0), coalesce(x.payout,0),
    coalesce(x.revenue,0), coalesce(x.profit,0), coalesce(x.raw,'{}'::jsonb)
  from jsonb_to_recordset(p_rows) as x(
    id text, metric_date date, affiliate_id text, affiliate_name text,
    offer_id text, offer_name text, campaign_id text, campaign_name text,
    offer_url_id text, offer_url_name text, source_id text, sub_source text,
    clicks numeric, sois numeric, first_sales numeric, rebills numeric,
    coin_spend numeric, payout numeric, revenue numeric, profit numeric, raw jsonb
  );

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'metric replacement row count mismatch';
  end if;
  return v_count;
end;
$$;

alter function public.replace_metric_window(date,date,jsonb) owner to postgres;
revoke all on function public.replace_metric_window(date,date,jsonb) from public, anon, authenticated;
grant execute on function public.replace_metric_window(date,date,jsonb) to service_role;
commit;
