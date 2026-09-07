# WLX: Independent review follow-up

The independent review of `2c64bd8e13dfbd4681f170b97f3ec6b89df795b6`
(`25b6243b5906efa927022aba6686d0500be82003`) found two fail-closed defects
despite passing all 1,613 tests and a clean installation/build/audit.

## Unavailable maturity summaries

An overview used the original ungated verdict when a partner's persisted maturity
summary was missing, malformed, stale, or inapplicable to the requested historical
window. This could change a previously gated `WEITER TESTEN` to `AUSSCHALTEN`.
Every visible partner now uses the existing no-data maturity gate in that case.
The selected partner still uses its conversion index; fresh valid summaries,
positive verdicts, and the established zero-SOI dead-traffic rule are preserved.
No extra per-partner conversion queries are introduced.

## Malformed source snapshots

Returned snapshot objects without a rows array were silently skipped. A later
complete generation-marker check could therefore accept incomplete source history
for a block preview. The reader now rejects these objects. Absent affiliate-day
records and explicitly empty arrays remain valid. Bounded sequential batches and
abort signals are preserved.

Regression-first evidence: the corrected contracts failed eight assertions on
the prior implementation. All targeted cases pass after the fix, including an
additional source-preview rejection case. Full immutable gates and independent
re-review are recorded with the release fingerprint in Asana and the session report.

## Approved production index

The user's earlier explicit approval was recovered from the prior task. The
already versioned `20260906215000_index_affiliate_conversion_reads.sql` was executed
as one standalone SQL Editor statement using `CREATE INDEX CONCURRENTLY` on
2026-09-07 around 21:09 UTC. No migration transaction, blocking substitute, data
repair, backfill, role change, or provider mutation was performed.

Immediate preflight: no existing index or active build; no other active query;
3.25 of 8 GB disk used; daily backup 2026-09-07 05:06:17 UTC present. Read-back at
21:09:42 UTC: exact index definition, ready and valid, 64 MB, no active build.
The same 90-day partner query now uses the combined affiliate/time index directly
instead of a time scan, subsequent affiliate filter, and incremental sort.
The measured 1,000-row query executed in 822.937 ms. This is one measured query,
not a global application or backfill performance guarantee.

Rollback remains the separately verified standalone `DROP INDEX CONCURRENTLY`
for this exact index from the existing database runbook; it was not executed.
This standalone index operation does not add an entry to Supabase migration
history. Do not replay the old migrations or claim that history is reconciled.

Provider lifecycle, role/session fixtures, OneSignal revocation/delivery, complete
backfill/raw parity, and the full browser state matrix retain their own acceptance
criteria and require actual evidence before their Asana tasks can close.
