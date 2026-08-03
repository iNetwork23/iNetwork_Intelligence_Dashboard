-- Run this file by itself. CREATE INDEX CONCURRENTLY must not be wrapped in BEGIN/COMMIT.
-- A versioned replacement is built without dropping any serving index first.
create index concurrently if not exists conversions_fraud_source_v2_idx
  on public.conversions (affiliate_id, offer_id, traffic_mode, source_id, sub_source, converted_at);
