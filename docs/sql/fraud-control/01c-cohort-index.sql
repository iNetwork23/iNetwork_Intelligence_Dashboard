-- Run this file by itself. CREATE INDEX CONCURRENTLY must not be wrapped in BEGIN/COMMIT.
-- A versioned replacement is built without dropping any serving index first.
create index concurrently if not exists conversions_fraud_cohort_v2_idx
  on public.conversions (offer_id, lead_id, converted_at, type)
  where coalesce(status, 'approved') = 'approved' and is_scrub = false;
