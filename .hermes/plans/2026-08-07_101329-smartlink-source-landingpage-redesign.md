# Smartlink Executive & Source×Landingpage Workspace Implementation Plan

> **For Hermes:** Execute this plan task-by-task with strict RED–GREEN–REFACTOR, then independent review and production verification.

**Goal:** Rebuild the selected Smartlink Campaign detail into a 10–15-second decision workspace that preserves the useful LP evidence, exposes every Source×Landingpage relationship, compares sources across LPs, and keeps full audit evidence available without dominating the primary view.

**Architecture:** Keep all existing loaders, KPI definitions, attribution logic, write paths, RBAC and time-window contracts unchanged. Add a pure presentation model that aggregates exact Source/Sub1 or ADV1/ADV2 combinations across current landing pages. Present one campaign-level decision surface, then a client-side two-mode workspace (`Landingpages` / `Sources über Landingpages`) built from the already-loaded per-LP source data. Move hourly, multi-window and audit diagnostics behind one secondary disclosure rather than deleting them.

**Tech Stack:** Next.js App Router, React/TypeScript, CSS Modules/global CSS, Vitest, React server rendering tests, Supabase-backed existing read models.

---

## Product contract

### Decisions supported in 10–15 seconds
1. Is the selected Campaign profitable in the chosen period?
2. How much of the result belongs to the current rotation versus pre-rotation, transition-day, legacy or unassigned facts?
3. Which current LP requires action first, and is the evidence mature enough?
4. Which exact Source×LP pairings have factually different observed results?
5. Does one source work on one LP but lose money on another?
6. Is the next step an approved LP action, a factual Source×LP observation, or blocked by incomplete evidence?

### Primary hierarchy
1. Campaign result and one plain-language conclusion.
2. Monetary-impact-sorted action queue.
3. Current LP comparison.
4. Cross-LP source comparison.
5. Selected LP/source evidence.
6. Full attribution, short trend, hourly data, rebill concentration, legacy history and audit metadata.

### Safety and semantic guardrails
- Never infer that historical loss belongs to current LPs.
- Never distribute unassigned revenue/payout silently.
- Never call a rate 0% when its denominator is zero; render `n/a`.
- Preserve `First-Sale-Rate = First-Sales ÷ SOIs`; Rebills are not First-Sales.
- Preserve tracked `Source/Sub1` and clickless `ADV1/ADV2` labels.
- Keep Source snapshot coverage independent from Campaign and LP windows.
- Keep current source blocking semantics explicit: payout/postback suppression, not physical traffic routing.
- Never create Source-to-LP routing recommendations. Use factual wording such as `Auf LP X profitabler beobachtet`.
- Do not create new thresholds that look like partner-approved stop rules. Show factual best/worst fit and reuse only existing LP recommendations.
- Preserve `offerId` in every Source×LP cell; source suppression is Affiliate + Offer scoped.
- Never omit a critical active-LP recommendation. Cap only secondary observations.
- Incomplete or unreconciled source coverage suppresses winner/loser conclusions and renders absent cells as `Unbekannt`, never zero.
- Existing source enrichment remains optional; its failure must not hide core Campaign/LP economics.

---

### Task 1: Add the pure Source×Landingpage presentation model

**Objective:** Build a deterministic, side-effect-free model that groups exact source tuples across LPs and identifies factual best/worst pairings without changing business calculations.

**Files:**
- Create: `src/lib/smartlink-source-workspace.ts`
- Create: `src/lib/smartlink-source-workspace.test.ts`
- Read only: `src/lib/smartlink.ts`

**Step 1: Write failing tests**

Cover:
- same tracked Source/Sub1 on two LPs becomes one cross-LP row with two cells;
- same main Source with different Sub1 values remains separate;
- clickless rows retain ADV1/ADV2 semantics and `cvr: null`;
- total revenue, payout, profit, SOIs, First-Sales, Rebills and Coin-Spend equal the exact sum of the cells;
- strongest/weakest LP use profit first with deterministic tie-breaking;
- factual `Auf LP X profitabler beobachtet` appears only when coverage is complete and reconciled;
- every cell retains LP and Offer identity;
- an absent source cell is zero only with complete reconciled coverage, otherwise `Unbekannt`;
- low/ambiguous/no-data states never manufacture a stop recommendation;
- source arrays and slot arrays are not mutated;
- missing technical values remain `Nicht übermittelt` for display but do not collide with real provider values.

**Step 2: Verify RED**

Run:
```bash
npm test -- --run src/lib/smartlink-source-workspace.test.ts
```
Expected: FAIL because the module/API does not exist.

**Step 3: Implement minimal pure model**

Proposed public API:
```ts
export type SourceLandingpageCell = {
  landingpageId: string;
  landingpageName: string;
  metrics: SmartlinkSourceBreakdown;
};

export type CampaignSourceRow = {
  key: string;
  mode: 'tracked' | 'api';
  source: string;
  subSource: string;
  cells: SourceLandingpageCell[];
  totals: SourceLandingpageMetrics;
  bestLandingpageId: string | null;
  worstLandingpageId: string | null;
  fit: 'positive' | 'negative' | 'mixed' | 'insufficient';
};

export function buildCampaignSourceRows(slots: SmartSlot[]): CampaignSourceRow[];
```

Use collision-resistant tuple serialization, copied arrays and exact additive sums.

**Step 4: Verify GREEN**

Run the focused test; expected all tests pass.

---

### Task 2: Make each LP master card expose its important sources

**Objective:** Preserve the existing LP cards while making source context visible without opening the full analysis.

**Files:**
- Modify: `src/app/components/SmartlinkPresentation.tsx`
- Modify: `src/lib/smartlink-presentation-render.test.tsx`
- Modify: `src/app/globals.css`

**Step 1: Write failing render tests**

Require each LP master card to show:
- source-combination count;
- strongest observed source pairing and profit;
- weakest observed source pairing and profit when distinct;
- `Quellen unvollständig` when snapshot coverage has missing days;
- no fabricated source status when rows are empty;
- exact `Source/Sub1` versus `ADV1/ADV2` labels.

**Step 2: Verify RED**

Run the targeted render test and confirm missing compact source markers.

**Step 3: Implement compact source preview**

Add a restrained source strip below the four existing LP KPIs. Keep the master card compact; show at most strongest and weakest pairings plus the source count. Full evidence remains in the selected LP detail.

**Step 4: Verify GREEN and refactor**

Run render and presentation tests. Ensure card selection, sorting and keyboard behavior remain unchanged.

---

### Task 3: Add the cross-LP source workspace

**Objective:** Let the user switch between LP-centric and source-centric analysis without navigating away or opening nested panels.

**Files:**
- Modify: `src/app/components/SmartlinkPresentation.tsx`
- Modify: `src/lib/smartlink-presentation.ts`
- Modify: `src/lib/smartlink-presentation.test.ts`
- Modify: `src/lib/smartlink-presentation-render.test.tsx`
- Modify: `src/app/globals.css`

**Step 1: Write failing behavior tests**

Require:
- top-level tabs `Landingpages` and `Sources über Landingpages`;
- complete keyboard navigation between both modes;
- source mode renders every grouped source tuple;
- each source row states affected LP count, total SOIs, First-Sales, Rebills, revenue, payout and profit;
- best and worst LP pairing are visible with absolute values;
- observation language is factual (`Auf LP … profitabler beobachtet`) and never an executable routing action;
- source cell rate uses that cell’s own SOIs;
- zero-denominator rate renders `n/a`;
- mobile markup exposes labels and does not rely solely on a wide table.

**Step 2: Verify RED**

Run focused presentation tests and confirm the source workspace is absent.

**Step 3: Extend presentation state**

Add a campaign-workspace mode alongside the existing selected-LP tabs. Keep one selected source tuple and one selected LP at a time. Switching modes must not mutate live rotation order or source data.

**Step 4: Render source comparison**

Desktop:
- compact source master list;
- selected source detail with LP comparison cards.

Mobile/tablet:
- vertical labeled cards;
- no primary horizontal-scroll requirement.

**Step 5: Keep source actions exact**

If existing block controls are surfaced in source detail, label their exact scope and retain the existing confirmation flow. Add visible copy that traffic routing remains partner-controlled.

**Step 6: Verify GREEN**

Run presentation unit/render tests and source-block regression tests.

---

### Task 4: Replace equal-weight Campaign diagnostics with an executive decision surface

**Objective:** Make Campaign result, current actionable economics and next actions visible before technical diagnostics.

**Files:**
- Modify: `src/app/affiliates/AffiliateSmartlinks.tsx`
- Create or modify test: `src/lib/affiliate-smartlink-decision-render.test.tsx`
- Modify: `src/app/globals.css`

**Step 1: Write failing render tests**

Require a selected Campaign to render, in this order:
1. Campaign conclusion;
2. primary selected-period profit formula;
3. current-rotation contribution when attribution exists;
4. every critical active-LP action, followed by a capped set of secondary observations;
5. LP/source workspace;
6. secondary diagnostics disclosure.

Test the key semantic cases:
- total loss mostly pre-rotation: conclusion must not blame current LPs;
- current LP loss with mature existing LP recommendation: action queue names that LP/action;
- current LP result inconclusive: `Weiter testen` rather than stop;
- unassigned payout/revenue: visible data-quality action;
- incomplete source coverage: warning but core KPIs remain visible;
- positive delayed legacy revenue with zero current First-Sales is described as legacy/delayed revenue.

**Step 2: Verify RED**

Run the new focused render test; expected failure because the executive surface does not exist.

**Step 3: Implement one Campaign decision hero**

Primary content:
- `Campaign #… verliert/verdient … im gewählten Zeitraum`;
- formula `Umsatz − Payout = Profit`;
- current rotation contribution;
- historical/pre-rotation share in neutral context;
- source/data confidence badge.

Avoid presenting `Rechnerisch abgestimmt` as green business performance; use neutral information styling.

**Step 4: Implement action queue**

Sort by:
1. critical existing LP recommendations;
2. current active loss / source pairing concerns;
3. unassigned money / incomplete coverage;
4. positive scale candidates.

Each item includes verb, reason, monetary impact or evidence, exact entity and CTA/inspection target. Never omit a second active critical candidate merely because one is worse.

**Step 5: Move diagnostics**

Place these into `Weitere Campaign-Diagnostik`:
- 24h/72h/14d KPI windows;
- hourly chart;
- audit strip;
- rebill concentration;
- full attribution ledger;
- short-term comparison.

Keep all existing values and labels; change presentation only.

**Step 6: Verify GREEN**

Run focused render tests and existing revenue-origin/attribution regressions.

---

### Task 5: Reduce duplicated page-level hierarchy

**Objective:** Remove repeated context around the selected Campaign while preserving pickers, URLs, RBAC and navigation.

**Files:**
- Modify: `src/app/affiliates/page.tsx`
- Modify: `src/app/affiliates/AffiliateSmartlinkOverview.tsx` only if needed for selected-state duplication
- Modify relevant render/source contract tests
- Modify: `src/app/globals.css`

**Step 1: Write failing source/render contract**

Require:
- selected Campaign detail has one authoritative Campaign headline;
- partner, Campaign, traffic mode and period remain visible in compact context;
- partner-wide overview remains available but is visually secondary when one Campaign is selected;
- no duplicate selected Campaign recommendation prose above and inside the detail;
- refresh, watchlist, permission and deep-link behaviors remain present.

**Step 2: Verify RED**

Run the targeted page/source contract.

**Step 3: Apply minimal page restructuring**

Do not rewrite data loading. Hide or subordinate the partner-wide action overview when a Campaign is explicitly selected; keep it for the no-Campaign portfolio state. Preserve all query parameters and `sourceOpen` deep-link compatibility.

**Step 4: Verify GREEN**

Run affiliate overview, workflow, RBAC and route tests.

---

### Task 6: Responsive and accessibility polish

**Objective:** Make the new hierarchy usable at desktop, intermediate and mobile widths without losing exact evidence.

**Files:**
- Modify: `src/app/globals.css`
- Modify render/source CSS contracts

**Step 1: Write failing style/markup contracts**

Require:
- source matrix becomes labeled cards below the tablet breakpoint;
- primary action controls meet 44px touch targets;
- status uses text/icon plus color;
- tabs have complete ARIA relationships and keyboard reachability;
- profit comparison has no misleading relative bar;
- source tuple labels never clip provider values;
- one/two/three/four LP cardinalities remain balanced.

**Step 2: Verify RED**

Run targeted contracts.

**Step 3: Implement responsive styles**

Use neutral surfaces, one interaction accent, red only for loss/urgent action, amber for uncertainty, green for proven positive economics. Build hierarchy with spacing and typography rather than nested borders.

**Step 4: Verify GREEN**

Run focused tests and `git diff --check`.

---

### Task 7: Canonical verification

**Objective:** Prove KPI correctness, behavior preservation and build quality.

**Commands:**
```bash
npm test -- --run src/lib/smartlink-source-workspace.test.ts
npm test -- --run src/lib/smartlink-presentation.test.ts src/lib/smartlink-presentation-render.test.tsx
npm test -- --run src/lib/smartlink-transparency.test.ts src/lib/affiliate-smartlink-revenue-render.test.tsx
npx tsc --noEmit
npm test
npm run lint
npm run build
git diff --check
```

**Acceptance:**
- all focused and full tests pass;
- no TypeScript or ESLint errors;
- production build succeeds;
- no whitespace errors;
- no changes to KPI calculations, loaders, RBAC, source-block writer or Campaign writer;
- no stale/unrelated worktree changes.

---

### Task 8: Independent review and production release

**Objective:** Release only after an immutable semantic and code-quality review.

**Steps:**
1. Record base SHA and final checkpoint SHA.
2. Review exact SHA range for KPI/window correctness, source tuple collisions, mobile semantics, action safety, optional-enrichment resilience and scope language.
3. Fix blockers via new RED–GREEN cycles.
4. Rerun every canonical gate after final semantic edit.
5. Commit directly to `main` per repository convention.
6. Push `origin/main`.
7. Deploy production through the existing Vercel project.
8. Verify canonical alias, health endpoint, deployment identity and worktree cleanliness.
9. Verify protected-route changed-body markers. If authenticated browser control remains unavailable, state clearly that pixel/click verification is blocked and do not overclaim it.

---

## Likely files changed
- `src/lib/smartlink-source-workspace.ts` (new)
- `src/lib/smartlink-source-workspace.test.ts` (new)
- `src/lib/smartlink-presentation.ts`
- `src/lib/smartlink-presentation.test.ts`
- `src/lib/smartlink-presentation-render.test.tsx`
- `src/app/components/SmartlinkPresentation.tsx`
- `src/app/affiliates/AffiliateSmartlinks.tsx`
- `src/app/affiliates/page.tsx`
- `src/app/affiliates/AffiliateSmartlinkOverview.tsx` (only if selected-state duplication requires it)
- `src/app/globals.css`
- one new Campaign decision render test

## Explicit non-goals
- No new Everflow live request from the interactive route.
- No schema migration.
- No change to source-blocking or Campaign mutation semantics.
- No automatic partner traffic routing.
- No invented source-level statistical thresholds.
- No removal of audit evidence; only hierarchy and disclosure changes.

## Principal risks
1. **Window mismatch:** Source snapshots, LP maturity and selected Campaign range differ. Every value must retain its own visible window.
2. **False routing implication:** Recommendations must not look executable when traffic is partner-controlled.
3. **Tuple collision:** Missing values and delimiter-containing provider strings require safe keys.
4. **Over-attribution:** Cross-LP totals must sum exact cells; incomplete coverage must remain visible.
5. **Dense mobile UI:** Convert comparison rows to labeled cards rather than relying on horizontal scroll.
6. **Optional enrichment failure:** Source workspace failure must not erase core Campaign economics.
7. **Production visual verification:** Current computer-use backend is unavailable; release evidence may need to remain source/render/deployment based unless restored.
