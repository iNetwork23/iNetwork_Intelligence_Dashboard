begin;
set local lock_timeout = '5s';
set local statement_timeout = '5min';

alter table public.conversions
  drop constraint if exists conversions_type_check;

alter table public.conversions
  add constraint conversions_type_check
  check (type in ('soi', 'coin_spend', 'first_sale', 'rebill'));

alter table public.conversions
  add column if not exists click_at timestamptz,
  add column if not exists traffic_mode text not null default 'unknown'
    check (traffic_mode in ('tracked_smartlink', 'tracked_direct', 'clickless_api', 'unknown')),
  add column if not exists source_dimension text not null default 'unknown',
  add column if not exists sub_source_dimension text not null default 'unknown',
  add column if not exists country_code text,
  add column if not exists is_scrub boolean not null default false,
  add column if not exists error_code text;

create table if not exists public.fraud_stop_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_id text not null,
  source text,
  sub_source text,
  source_dimension text check (source_dimension in ('source_id', 'adv1')),
  sub_source_dimension text check (sub_source_dimension in ('sub1', 'sub2', 'sub3', 'sub4', 'sub5', 'adv2')),
  offer_id text,
  scope text not null check (scope in ('offer', 'all_offers')),
  requested_at timestamptz not null,
  grace_hours integer not null default 24 check (grace_hours between 1 and 168),
  channel text not null default 'telegram',
  reference text,
  note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  check ((scope = 'offer' and offer_id is not null) or (scope = 'all_offers' and offer_id is null)),
  check (source is not null or sub_source is not null),
  check ((source is null and source_dimension is null) or (source is not null and source_dimension is not null)),
  check ((sub_source is null and sub_source_dimension is null) or (sub_source is not null and sub_source_dimension is not null)),
  check (source_dimension is null or sub_source_dimension is null or
    (source_dimension = 'adv1' and sub_source_dimension = 'adv2') or
    (source_dimension = 'source_id' and sub_source_dimension in ('sub1', 'sub2', 'sub3', 'sub4', 'sub5'))),
  check (source is null or length(source) between 1 and 200),
  check (sub_source is null or length(sub_source) between 1 and 200)
);

create index if not exists fraud_stop_requests_active_idx
  on public.fraud_stop_requests (affiliate_id, source, sub_source, requested_at)
  where deactivated_at is null;

alter table public.fraud_stop_requests enable row level security;
revoke all on public.fraud_stop_requests from public, anon, authenticated;
grant all on public.fraud_stop_requests to service_role;

comment on table public.fraud_stop_requests is
  'Read-only fraud monitor inputs for documented partner traffic-stop requests. No Everflow mutation is triggered by this table.';

commit;

-- Run online index builds outside the transaction so conversion writes remain available.
drop index concurrently if exists public.conversions_fraud_source_idx;
create index concurrently conversions_fraud_source_idx
  on public.conversions (affiliate_id, offer_id, traffic_mode, source_id, sub_source, converted_at);

drop index concurrently if exists public.conversions_fraud_cohort_idx;
create index concurrently conversions_fraud_cohort_idx
  on public.conversions (offer_id, lead_id, converted_at, type)
  where coalesce(status, 'approved') = 'approved' and is_scrub = false;

drop index concurrently if exists public.conversions_fraud_timing_idx;
create index concurrently conversions_fraud_timing_idx
  on public.conversions (traffic_mode, converted_at, click_at)
  where type = 'soi' and click_at is not null and is_scrub = false;

analyze public.conversions;
analyze public.fraud_stop_requests;
