begin;
set local lock_timeout = '5s';
set local statement_timeout = '5min';

create or replace function public.replace_conversion_window(
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
  v_from timestamptz;
  v_to_exclusive timestamptz;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 6 then
    raise exception 'invalid conversion replacement window';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 50000 then
    raise exception 'invalid conversion replacement payload';
  end if;
  v_from := p_from::timestamp at time zone 'Europe/Berlin';
  v_to_exclusive := (p_to + 1)::timestamp at time zone 'Europe/Berlin';
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as x(id text,type text,converted_at timestamptz,lead_id text)
    where nullif(btrim(x.id),'') is null
       or nullif(btrim(x.lead_id),'') is null
       or x.type not in ('soi','coin_spend','first_sale','rebill')
       or x.converted_at < v_from
       or x.converted_at >= v_to_exclusive
  ) then
    raise exception 'conversion replacement row outside contract';
  end if;

  delete from public.conversions
  where converted_at >= v_from
    and converted_at < v_to_exclusive;

  insert into public.conversions (
    id,type,converted_at,click_at,offer_url_id,source_id,sub_source,
    source_dimension,sub_source_dimension,traffic_mode,country_code,is_scrub,error_code,
    cost,revenue,payout,lead_id,raw,status,affiliate_id,affiliate_name,
    offer_id,offer_name,offer_url_name,campaign_id,campaign_name
  )
  select
    x.id,x.type,x.converted_at,x.click_at,x.offer_url_id,x.source_id,x.sub_source,
    x.source_dimension,x.sub_source_dimension,x.traffic_mode,x.country_code,coalesce(x.is_scrub,false),x.error_code,
    coalesce(x.cost,0),coalesce(x.revenue,0),coalesce(x.payout,0),x.lead_id,coalesce(x.raw,'{}'::jsonb),x.status,x.affiliate_id,x.affiliate_name,
    x.offer_id,x.offer_name,x.offer_url_name,x.campaign_id,x.campaign_name
  from jsonb_to_recordset(p_rows) as x(
    id text,type text,converted_at timestamptz,click_at timestamptz,offer_url_id text,source_id text,sub_source text,
    source_dimension text,sub_source_dimension text,traffic_mode text,country_code text,is_scrub boolean,error_code text,
    cost numeric,revenue numeric,payout numeric,lead_id text,raw jsonb,status text,affiliate_id text,affiliate_name text,
    offer_id text,offer_name text,offer_url_name text,campaign_id text,campaign_name text
  );

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_rows) then
    raise exception 'conversion replacement row count mismatch';
  end if;
  return v_count;
end;
$$;

revoke all on function public.replace_conversion_window(date,date,jsonb) from public, anon, authenticated;
grant execute on function public.replace_conversion_window(date,date,jsonb) to service_role;
commit;
