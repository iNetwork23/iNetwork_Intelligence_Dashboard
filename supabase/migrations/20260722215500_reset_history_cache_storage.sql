-- Recover the regenerable Everflow cache after the original raw JSON payloads filled the database.
-- Run once in the Supabase SQL editor. The sync will rebuild all rows without raw payload duplication.

begin;

truncate table public.conversions, public.daily_metrics, public.sync_state;

alter table public.conversions
  alter column raw set default '{}'::jsonb;

alter table public.daily_metrics
  alter column raw set default '{}'::jsonb;

commit;

analyze public.conversions;
analyze public.daily_metrics;
