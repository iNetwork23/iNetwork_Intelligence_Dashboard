-- Production application requires explicit approval before this migration.
-- Preserve the literal partial-index predicate when PostgREST uses generic plans.
BEGIN;

CREATE VIEW public.affiliate_approved_conversions
WITH (security_invoker = true)
AS
SELECT id, affiliate_id, converted_at, raw, type, lead_id
FROM public.conversions
WHERE status = 'approved' OR status IS NULL;

REVOKE ALL ON public.affiliate_approved_conversions
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.affiliate_approved_conversions TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
