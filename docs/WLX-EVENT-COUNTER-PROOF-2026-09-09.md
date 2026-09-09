# Historical import: mutable relationship event count

Production diagnostic at 2026-09-09 19:43:15 UTC, deployment dpl_B9BALNfeNDBhopzoZH5SSWkW4U9Z, rejected April 13 with 2,705 received / 2,704 distinct IDs. Complete traversals at sizes 2,000 and 997 matched; size 503 differed in exactly one row, solely in `relationship.events_count`. IDs and multiplicities were identical; no money, timestamp or conversion field changed.

The [Everflow conversion response schema](https://developers.everflow.io/api-reference/post-networksreportingconversions) includes this numeric relationship counter. Source inspection confirms neither `conversionToCacheRow`, conversion report rows nor fraud event projections consume it. Actual events are loaded as conversion rows and checked separately. Its mutability in this incident is an observation from production diagnostics, not an API stability guarantee.

Only valid non-negative safe integer event counts are normalized to zero when computing the comparison proof. The original provider object is returned unchanged. Missing keys, invalid counter types and every other field remain part of the proof. Three complete matching traversals, identical IDs and multiplicities, page coverage, raw total count and duplicate/boundary safeguards remain mandatory. No imported rows are synthesized or omitted to satisfy a count.

Regression: a changing numeric counter previously rejected identical conversion data; now accepted after exactly three traversals with raw metadata preserved. Changes in affiliate, offer, campaign, landing-page relationship or invalid counter type still reject. Existing identity, money, missing-row, page overlap and count drift tests remain unchanged.

Rollback: revert the commit; the previous conservative rejection returns. Deployment changes code only. Subsequent imports require the existing approved maximum three-day scope and fresh shared lease checks.

## Follow-up after production readback at 19:51 UTC

The 19:49:44 run on PR70 still differed solely in `relationship.events_count`. Normalizing valid numeric counters therefore did not cover the provider response. The comparison now excludes the exact derived metadata key, regardless of format or presence. Every other relationship field and all actual event rows remain checked. This is justified by the complete consumer audit, not by assuming the provider counter is stable or always numeric. Original metadata is returned unchanged; it is never used to establish imported event counts or financial totals.

Five regression cases reproduce changing/present/absent counter metadata with numeric, string, object, array and null values. All preserve raw payloads and require three complete traversals. Non-counter relationship changes still reject, as do unknown fields, money, IDs, multiplicities and pagination failures. The earlier numeric-only validation paragraph describes PR70, not the final comparison behavior.
