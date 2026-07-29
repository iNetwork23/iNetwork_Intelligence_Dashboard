-- Speeds up per-affiliate Rebill customer distribution queries.
create index if not exists conversions_rebill_affiliate_time_id_idx
on public.conversions (affiliate_id, converted_at, id)
where type = 'rebill' and (status = 'approved' or status is null);
