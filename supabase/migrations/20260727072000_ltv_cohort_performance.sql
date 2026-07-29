-- Optimize the affiliate-safe LTV cohort view without changing its authorization semantics.
-- Supabase SQL Editor runs statements in a transaction, so plain idempotent indexes are used.
set statement_timeout = '10min';

create index if not exists conversions_ltv_registrations_idx
  on public.conversions (affiliate_id, lead_id, converted_at)
  include (offer_id, campaign_id, source_id, sub_source)
  where type = 'soi' and coalesce(status, 'approved') = 'approved';

create index if not exists conversions_ltv_sales_idx
  on public.conversions (affiliate_id, lead_id, converted_at)
  include (revenue)
  where type in ('first_sale', 'rebill') and coalesce(status, 'approved') = 'approved';

analyze public.conversions;

reset statement_timeout;
