-- Run only within the approved rollback scope, after restoring the application
-- to 48b7a3fe3c3019fd30ac2dd48c54edd305620320 (which reads conversions directly).
-- No CASCADE: unexpected dependencies must stop the rollback.
BEGIN;
DROP VIEW public.affiliate_approved_conversions;
NOTIFY pgrst, 'reload schema';
COMMIT;
