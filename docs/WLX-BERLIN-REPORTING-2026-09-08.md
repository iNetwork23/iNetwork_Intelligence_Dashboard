# Berlin reporting correction — candidate, not deployed

Baseline: production `c5d9c70ad68949c7b82b1c0b55ff3f58bc34155d`.

The public Everflow metadata endpoint `https://api.eflow.team/v1/meta/timezones` identifies timezone 56 as Europe/Berlin and 80 as America/New_York. The production requests used 80 while UI periods, event aggregation and SQL window bounds use Berlin. A New York September 7 event at September 8 03:00 UTC maps to Berlin September 8 and was rejected by the September 7 metric replacement contract. The SQL boundary guard is correct and remains intact.

This candidate centralizes timezone 56 for all reporting requests. Range refreshes validate Berlin bounds before writing and split aggregate replacement into at most three inclusive days. Fraud catchup/backfill uses the same maximum instead of seven days.

## Data compatibility and deployment impact

- Daily portfolio/source/campaign markers require version 5, timezoneId 56 and a nonempty generation. Old range caches and direct aggregate fallbacks cannot bypass this proof. Activity, source candidate, lead maturity and Next caches have new namespaces.
- Old history state starts a new 365-day backfill on the next sync. Reports fail closed until every requested day has a Berlin proof; large periods will temporarily be unavailable during repair.
- Fraud starts a new version 4 checkpoint under `fraud_conversion_backfill_berlin_v4`, covering 120 days or the oldest active stop as required by the existing policy. Old parity evidence cannot mark it ready.
- Conversion event timestamps remain the provider UTC timestamps. History upserts by identity; the existing Fraud conversion replacement can remove stale rows within a successfully loaded and validated window. Production backup must therefore include conversions, daily_metrics and relevant sync_state data.
- Rebill buckets remain UTC. Only whole UTC days contained in the completed Berlin import can be published; cached UTC days are bound to the two corresponding Berlin day generations.
- No SQL contract, provider rule, user, role, deal or OneSignal setting is changed by this candidate. OneSignal is explicitly deferred at the user's request.

## Evidence

Regressions were demonstrated before the fix: wrong request timezone, old provenance accepted, oversized replacement windows. The candidate passes 205 files / 1,655 tests, TypeScript, production build, dependency and production dependency audits (zero vulnerabilities). ESLint: zero errors, one pre-existing unused-variable warning. Independent review is pending and must assess all reader boundaries, snapshot publication ordering and UTC bucket coverage.

Read-only production observation at 2026-09-07 22:33 UTC: history snapshot_version 4, 36 portfolio markers v4 and zero Berlin v5 markers; history backfill cursor 2026-08-01. LTV became ready at 22:30:24 UTC. Fraud legacy v3 remains in backfill without parity/coverage. These are observations of the deployed baseline, not acceptance of this candidate.

## Rollout remains unapproved

The original project instruction, section 8, requires a current preview and explicit confirmation for production migrations and backfills. Deploying this candidate triggers data repair, so a normal code rollback is insufficient. Before requesting approval: verify the exact candidate independently; measure affected tables and available backup/restore capability; prepare a bounded repair, verification and restoration scope. Before any production write: re-read the current state and confirm that scope. No candidate deployment or backfill has been executed.
