# Fraud evidence language acceptance

On production PR52, English Fraud rows still showed German maturity, identity warnings, timing evidence, the block heading and unknown probability values. Twelve new regression cases failed before the change.

Known warnings and labels now have exact translations. Three anchored evidence templates preserve the existing number and threshold tokens; the existing display formatter applies locale-specific decimal notation once. Arbitrary source IDs and company names do not match partial text. Each warning renders separately so multiple warnings remain independently translatable. Scores, cohort decisions, filters and business actions are unchanged.

Validation: fresh npm ci; 230 files / 1,872 tests; production build, type check and diff check passed; lint zero errors and two existing warnings; both dependency audits zero vulnerabilities. Native verification on the final production alias is recorded in the dated workspace acceptance report.
