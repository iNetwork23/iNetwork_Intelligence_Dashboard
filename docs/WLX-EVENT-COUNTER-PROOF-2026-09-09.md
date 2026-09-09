# Historical import: mutable relationship event count

Production diagnostic at 2026-09-09 19:43:15 UTC, deployment dpl_B9BALNfeNDBhopzoZH5SSWkW4U9Z, rejected April 13 with 2,705 received / 2,704 distinct IDs. Complete traversals at sizes 2,000 and 997 matched; size 503 differed in exactly one row, solely in `relationship.events_count`. IDs and multiplicities were identical; no money, timestamp or conversion field changed.

The [Everflow conversion response schema](https://developers.everflow.io/api-reference/post-networksreportingconversions) includes this numeric relationship counter. Source inspection confirms neither `conversionToCacheRow`, conversion report rows nor fraud event projections consume it. Actual events are loaded as conversion rows and checked separately. Its mutability in this incident is an observation from production diagnostics, not an API stability guarantee.

Only valid non-negative safe integer event counts are normalized to zero when computing the comparison proof. The original provider object is returned unchanged. Missing keys, invalid counter types and every other field remain part of the proof. Three complete matching traversals, identical IDs and multiplicities, page coverage, raw total count and duplicate/boundary safeguards remain mandatory. No imported rows are synthesized or omitted to satisfy a count.

Regression: a changing numeric counter previously rejected identical conversion data; now accepted after exactly three traversals with raw metadata preserved. Changes in affiliate, offer, campaign, landing-page relationship or invalid counter type still reject. Existing identity, money, missing-row, page overlap and count drift tests remain unchanged.

Rollback: revert the commit; the previous conservative rejection returns. Deployment changes code only. Subsequent imports require the existing approved maximum three-day scope and fresh shared lease checks.
