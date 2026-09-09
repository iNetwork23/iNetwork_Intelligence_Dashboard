-- Run only within the approved rollback scope, after restoring the application
-- to 36b394de6c7e5b77f4e079497ca54908259b0acd (which reads conversions directly).
-- No CASCADE: unexpected dependencies must stop the rollback.
BEGIN;
DROP VIEW public.affiliate_approved_conversions;
NOTIFY pgrst, 'reload schema';
COMMIT;
