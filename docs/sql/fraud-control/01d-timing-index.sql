-- Run this file by itself. CREATE INDEX CONCURRENTLY must not be wrapped in BEGIN/COMMIT.
-- A versioned replacement is built without dropping any serving index first.
create index concurrently if not exists conversions_fraud_timing_v2_idx
  on public.conversions (traffic_mode, converted_at, click_at)
  where type = 'soi' and click_at is not null and is_scrub = false;
