# Berlin reporting correction — prepared, not deployed

Production baseline: `c5d9c70ad68949c7b82b1c0b55ff3f58bc34155d`. Runtime candidate: `443b2905110157aac80115b6e5bc30a587bc6be9`.

The public [Everflow timezone metadata](https://api.eflow.team/v1/meta/timezones) identifies 56 as Europe/Berlin and 80 as America/New_York. Production requests used 80 while UI periods, event aggregation and SQL boundaries use Berlin. A New York September 7 event at September 8 03:00 UTC maps to Berlin September 8 and was rejected by the September 7 replacement contract. The SQL guard remains intact.

## Final changes

All reporting requests use timezone 56. Metric refreshes validate provider dates before writing and split replacement into at most three inclusive days. Fraud catchup/backfill uses the same limit instead of seven days. Old day/range snapshots cannot pass the new version 5 / timezone 56 proof. Source, candidate, maturity and outer Next caches have separate Berlin namespaces. Activity fingerprints include every day generation.

History rebuilds at least 365 days and preserves earlier valid checkpoint/metric history. It reads the oldest indexed metric date before resetting; a metadata read failure stops before writes. For the observed July 23, 2025 start, a September 8, 2026 reset covers 413 calendar days. The progress total reflects this. Conversion imports remain within their existing 365-day retention; older days request complete base and event aggregates with clickless API dimensions. They retain SOIs, sales, rebills, coin spend and money without double-counting base/event money. Missing or explicitly incomplete tables fail before publication. Everflow's [entity report](https://developers.everflow.io/api-reference/post-networksreportingentitytable) has a 10,000-row limit; daily affiliate/offer partitioning remains enforced.

Fraud starts a separate `fraud_conversion_backfill_berlin_v4` checkpoint, covering 120 days or the oldest active stop. Legacy parity cannot mark it ready. Rebill buckets remain UTC. Before canonical event writes, affected cached UTC days are invalidated, including partial days and empty replacements. Complete buckets bind to both covering Berlin day generations. The outer Rebill cache is also invalidated after sync attempts, including partial failures, without preventing lease release.

No provider rule, user, role, deal or OneSignal setting is changed by this candidate. OneSignal is explicitly deferred at the user's request.

## Production baseline observed, not repaired

At September 7, 22:33 UTC: history snapshot_version 4, 36 v4 portfolio markers and zero Berlin v5 markers; history cursor August 1, 2026. LTV was ready at 22:30:24 UTC. Fraud legacy v3 was in backfill without verified coverage/parity. At 22:38 UTC: conversions 871,749 estimated rows / 1,959 MB including indexes; daily_metrics 443,770 / 574 MB; sync_state 38,594 / 503 MB. Estimates are not exact backup counts.

Supabase lists a physical backup from September 7, 22:06:57 UTC. Point-in-time recovery is not enabled. No restore, purchase, candidate deployment or production repair was performed.

## Review and acceptance

The earlier candidate 005e6b5 independently passed 1,660 tests plus 20 additional review probes, TypeScript, build, audits and tracked-blob verification. Subsequent historical coverage and report-only corrections add eleven regressions; final review of 443b290 is pending at this document's creation. Lint has one pre-existing unused-variable warning.

Calendar or custom windows beginning before the verified history start remain unavailable until their earlier days have actual provider evidence. No preceding day is relabeled as zero. Complete historical-month/year UI acceptance, live provider/database parity, LTV refresh after repair, performance and the remaining role/write workflows remain separate open Asana criteria.

## Proposed production scope — requires explicit confirmation

The original project instruction, section 8, requires a current preview and explicit confirmation for production migrations and backfills. This deployment starts data repair, so normal code deployment permission is insufficient.

1. Re-read deployment SHA, history/Fraud/LTV states, oldest day, table sizes, free storage, active writers and constraints using `00-readback.sql`. Stop if the baseline or available storage differs materially; reserve space for the backup and WAL. Do not purchase capacity automatically.
2. Pause Vercel production for a maintenance window, wait for in-flight syncs to finish and verify quiescence. Vercel documents that [project pause returns HTTP 503](https://vercel.com/docs/projects/managing-projects), while a [new deployment does not stop already running cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Read-only checks and bounded database locks are required in addition to pausing.
3. Execute `01-backup.sql` exactly once. It snapshots conversions, daily_metrics and sync_state into a private schema, under one transaction. Read back the manifest and privileges. The SQL files live in docs/sql, not auto-applied migrations. Backup failure prevents rollout.
4. Deploy the final independently reviewed commit, verify its exact production SHA, and resume. Rebuild existing history with at most three days per replacement and the new Fraud checkpoint. Reports remain unavailable until their entire requested range has Berlin proofs. This can span many sync runs; neither duration nor overall success is assumed.
5. After each window, read back row counts, marker timezone/version, canonical event identity/type parity and financial totals. Verify API/SQL/UI parity on complete ranges and refresh/read back LTV. Stop further repair on incomplete provider responses, mismatches or resource failure.
6. If rollback is required, obtain a current restoration preview before using `02-restore.sql`. It rewinds only imported events, metrics and whitelisted reporting state; user/role/deal/provider configuration stays current. It flags LTV as failed until refreshed from restored events. Restore the reviewed baseline deployment, refresh LTV and clear reporting caches before reopening. Replaying later imported events may be necessary. Code rollback alone does not restore data.

`01-backup.sql` and `02-restore.sql` were exercised against local PostgreSQL 17.9 fixtures: exact event/metric/cache restoration, preservation of unrelated deal/user state, private backup permissions, and rejection of a duplicate or row-count-damaged backup before target mutation. Independent review found an additional NULL-manifest bypass, now corrected with NOT NULL/nonnegative manifest constraints, null-safe comparisons, baseline identity and timestamp checks. Final independent SQL recheck is pending. These are local tests, not production execution.
