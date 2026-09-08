# WLX — password provider boundary

Production baseline: `d8b51e64f2a367bfccd28e34999a84f1ded3ee25`, Vercel `dpl_ToZwTfEjzFALTyrL9kRhAcUmUyme`.

During the explicitly approved QA-account setup on 8 September, a 76-byte generated ASCII password passed the app form and server parser but the provider rejected account creation. The account list was reloaded and confirmed absent before retrying; the same account was then created with a 40-byte random password. Neither password was printed or stored in reports. Three approved QA identities were provisioned as Read only; subsequent rights and lifecycle checks remain separate acceptance work.

The previous validators allowed up to 128 JavaScript code units. Supabase Auth enforces a 72-byte bound (`len(password)` in Go), which also affects shorter strings containing multibyte characters. Primary source: [Supabase Auth password validation](https://github.com/supabase/auth/blob/master/internal/api/password.go).

The shared length check now rejects inputs above 72 UTF-8 bytes before provisioning or password setup, without modifying or truncating the password. Existing 12-character provisioning and 14-character setup minimums, setup complexity, token, confirmation and revocation rules are retained. Both forms use the same bound and show native field feedback in DE/EN; server checks also protect direct API requests.

Ten regression cases cover both entry points, exactly 72-byte ASCII/Unicode inputs and excessive ASCII, umlaut and emoji inputs. Six excessive-length cases failed on the baseline and pass after the fix. Local complete suite: 215 files / 1,734 tests; Typecheck, build, diff and both audits pass. Lint: zero errors and the existing sidebar-test warning. Independent exact-commit review and final native production checks are recorded separately; this document alone does not claim them.

The separately approved function-local import budget was applied through the Supabase SQL editor at approximately 12:10 UTC. Read-back at 12:10:52.633699 UTC confirms `statement_timeout=45s` and `lock_timeout=5s`, unchanged body MD5 `4d68797ccb3e7b90cb98fc5ab9a8564d`, postgres owner, service-role-only ACL and global 8-second settings. Versioned SQL: `supabase/migrations/20260908090600_bound_conversion_replacement_timeout.sql`; guarded reversal: `docs/sql/berlin-reporting-20260908/03-restore-conversion-timeout.sql`. This editor execution is not a claim that a Supabase migration-history row was automatically recorded. A new bounded RPC/parity run is still required to prove the live timing effect.
