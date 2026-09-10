# Authenticated QA follow-up · 10 September 2026

Native checks on production PR76 confirmed the approved scoped QA account sees only Affiliate 6. Its Automation legacy journal contains Campaign 2 only; the foreign canonical configuration is absent. Adding campaigns.edit, automations.manage, automations.live and api.manage did not grant campaign-wide operations. With the further Campaign 2 restriction, the campaign detail view loaded and no global pause/resume/block controls were present. The detail request was slow; this is not a performance acceptance.

The approved partner QA account with Affiliate 6 saw exactly one affiliate row, TrafficPartner #6, and no currency values or financial columns. Sources, cohorts, affiliate administration, automation, Fraud, source blocks, deals and access administration all denied access. The operator returned through the impersonation exit action. Database readback at 09:37:08 UTC confirmed all three QA accounts disabled with zero app sessions. Temporary grants and Campaign 2 were removed; the original scoped finance.view / Affiliate 6 baseline was restored. No invitations, password reset messages or business actions were performed.

The browser reported several React 418 recoveries during the original rapid English page matrix. Delayed content language tests and the native production rerun are tracked separately; do not infer all recoveries are solved from unit tests alone. Direct navigation to an API endpoint was blocked by the browser client, so API acceptance in this pass is provided by route tests, not a native HTTP status claim.

## Fixes

- Account copy controls, KPI accessibility labels, campaign directory and overview, permission descriptions and selected safety prompts now have English text. Campaign directory links and content own their locale through React, preserving event handlers and server hydration. Business identities remain literal. Delayed hydration tests switch EN to DE and check that campaign, affiliate and landing-page names do not change.
- A manual three-day History run failed on the existing 500-row conversion upsert with PostgreSQL statement timeout. Its checkpoint correctly remained at 6 March. Idempotent cache upserts now reduce only the failed batch, from 500 to 100 to at least 25 rows, retaining the successful prefix. The smaller size is retained for the rest of that import. Other errors and failures at the floor stop immediately. No database timeout, SQL function, lease, import window, checkpoint or readiness policy is changed.
- Fraud 19–21 July completed with matching stored/expected event counts and identity digest. It is still an incomplete 120-day import; readyAt remains null.

OneSignal remains excluded at the user's request. Full role/session and page matrices, complete historical imports, approved business lifecycle tests, physical PWA/WebPush delivery and independent final review remain outstanding.
