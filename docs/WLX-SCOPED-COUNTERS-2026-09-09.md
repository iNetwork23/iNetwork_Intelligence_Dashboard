# Assigned data scope: counters and source-block boundaries

Authenticated production reproduction with the approved scoped QA employee (Affiliate 6, finance.view): business rows were restricted correctly, but the sidebar showed 25 global switch-off candidates and the control room showed one active block owned by Affiliate 29 and global 50/50 partner coverage. API inspection also found unfiltered source-block list/effect/history reads behind compound permissions.

Changes:

- Sidebar counts use the current reader, with all six scope dimensions included in the cache key. Active block/incident counts include only fully authorized records.
- Scoped snapshots remove global partner and maturity counts; the UI describes the assigned scope without inventing coverage numbers. Incomplete coverage still warns.
- Source-block API lists, effects and server-rendered totals/markers are filtered. Foreign and missing history IDs both return 404 before history access.
- A main-source block affects every sub-source; an origin campaign is only provenance, not a provider restriction. Partial campaign/account scopes and sub-source users cannot inspect or mutate wider block records. Fresh write-lock checks retain the same containment rule. Deactivation responses also strip finance fields when required.
- A parent block affecting an authorized source may still show its status, but its out-of-scope ID/error details are redacted and broader actions are disabled.

Regression tests reproduce the original API and counter/coverage leaks. Tests cover own/foreign histories, lists/effects, scoped server rendering, multi-dimensional containment and denial before provider service invocation. No provider mutations or production business data changes are performed by these tests.

Runtime QA and cleanup are recorded separately in the workspace acceptance log. The three existing QA accounts and Affiliate 6 limitation remain the only authorized account-test scope. Reverting this patch would reintroduce the disclosed scope leaks and is not an acceptable routine rollback.
