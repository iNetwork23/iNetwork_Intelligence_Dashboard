begin;
set local lock_timeout = '5s';
set local statement_timeout = '5min';

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.strip_conversion_raw_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.raw := coalesce(new.raw, '{}'::jsonb) - 'adv4' - 'email';
  return new;
end;
$$;

revoke all on function public.strip_conversion_raw_identity() from public, anon, authenticated;

drop trigger if exists conversions_strip_raw_identity on public.conversions;
create trigger conversions_strip_raw_identity
before insert or update of raw on public.conversions
for each row execute function public.strip_conversion_raw_identity();

create or replace function public.repair_conversion_identity_batch(p_limit integer default 5000)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode='22023', message='invalid repair batch size';
  end if;

  with targets as (
    select row.ctid
    from public.conversions row
    where btrim(coalesce(row.lead_id, '')) = ''
       or coalesce(row.raw, '{}'::jsonb) ? 'adv4'
       or coalesce(row.raw, '{}'::jsonb) ? 'email'
       or (
         row.converted_at >= current_date - interval '365 days'
         and row.lead_id !~ '^(api-customer-sha256|unjoinable-(sha256|legacy-sha256)):[0-9a-f]{64}$'
         and (
           row.traffic_mode = 'clickless_api'
           or (
             row.traffic_mode = 'unknown'
             and row.click_at is null
             and nullif(btrim(coalesce(row.raw->>'adv1', row.raw->>'adv2', '')), '') is not null
           )
         )
       )
    order by row.converted_at, row.id
    limit p_limit
    for update skip locked
  )
  update public.conversions row
  set lead_id = case
        when btrim(coalesce(row.lead_id, '')) = ''
          then 'unjoinable-legacy-sha256:' || encode(extensions.digest(convert_to('legacy:' || row.id, 'UTF8'), 'sha256'), 'hex')
        when row.converted_at >= current_date - interval '365 days'
          and row.lead_id !~ '^(api-customer-sha256|unjoinable-(sha256|legacy-sha256)):[0-9a-f]{64}$'
          and (
            row.traffic_mode = 'clickless_api'
            or (
              row.traffic_mode = 'unknown'
              and row.click_at is null
              and nullif(btrim(coalesce(row.raw->>'adv1', row.raw->>'adv2', '')), '') is not null
            )
          )
          then case
            when nullif(btrim(coalesce(row.raw->>'adv4', row.raw->>'email', '')), '') is not null
              then 'api-customer-sha256:' || encode(extensions.digest(convert_to(lower(btrim(coalesce(row.raw->>'adv4', row.raw->>'email'))), 'UTF8'), 'sha256'), 'hex')
            else 'unjoinable-legacy-sha256:' || encode(extensions.digest(convert_to('legacy:' || row.id, 'UTF8'), 'sha256'), 'hex')
          end
        else row.lead_id
      end,
      raw = coalesce(row.raw, '{}'::jsonb) - 'adv4' - 'email'
  from targets
  where row.ctid = targets.ctid;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter function public.repair_conversion_identity_batch(integer) owner to postgres;
revoke all on function public.repair_conversion_identity_batch(integer) from public, anon, authenticated;
grant execute on function public.repair_conversion_identity_batch(integer) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversions_lead_id_nonempty_check'
      and conrelid = 'public.conversions'::regclass
  ) then
    alter table public.conversions
      add constraint conversions_lead_id_nonempty_check
      check (length(btrim(lead_id)) > 0) not valid;
  end if;
end
$$;

commit;
