-- Run as one standalone statement over an autocommit PostgreSQL connection.
-- Never wrap CREATE INDEX CONCURRENTLY in a transaction; see the read-back runbook.
-- Production execution requires the explicit scope documented in that runbook.
create index concurrently if not exists conversions_affiliate_converted_id_approved_idx
  on public.conversions (affiliate_id, converted_at, id)
  where (status = 'approved' or status is null);
