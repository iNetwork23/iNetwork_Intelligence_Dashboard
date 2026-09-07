# Rebill cache: preserve unknown attribution without inventing customer coverage

The first authorized Berlin history repair on production `c6d7c4c` persisted September 6–8, 2026 with version 5 / timezone 56 evidence. History advanced to September 5, preserving the July 23, 2025 start. The HTTP request then failed in Rebill snapshot publication with `gültiges traffic_mode fehlt`.

A read-only aggregate of the complete UTC buckets September 6–7 found 56 first sales and 204 rebills classified as `unknown`; all had deliberately unjoinable customer identities. `unknown` is a valid canonical traffic mode accepted by the raw Rebill loader, but the snapshot validator omitted it. It must remain unknown rather than being discarded or reclassified as tracked/API traffic.

Snapshot publication and decoding now accept `unknown`. The shared Rebill customer index retains the event in its own traffic-mode bucket, while representing unknown attribution or any recognized unavailable-identity marker as a null customer. Event completeness and customer-identity completeness remain distinct. Known tracked/API paths are isolated; malformed traffic modes still fail closed.

Four new regressions failed before the correction: actual provider conversion → canonical row → snapshot → reader → concentration, plus the three recognized unavailable-identity prefixes for both first sales and rebills. After correction, 209 test files / 1,675 tests, lint (zero errors / one pre-existing warning) and production build pass. Independent review and live follow-up must be recorded against the resulting exact commit.

No business rule, role, deal, provider configuration or OneSignal setting changes. No new SQL migration or checkpoint rewrite is required. The already verified private production backup remains the rollback baseline. The first window's final cache publication failed after its history cursor advanced; the bounded rolling/reconciliation paths can republish it after the fix, and readers retain a canonical fallback for missing snapshots. Backfill and production acceptance remain open until verified.
