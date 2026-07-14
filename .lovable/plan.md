
# Wealth Flightpath — Architecture Consolidation

Goal: stop adding features. Restructure what exists so the four questions
("Where am I today? On track? What changed? What next?") map cleanly to
four distinct concepts in the codebase: **Current Reality**, **App
Settings**, **Planning Assumptions**, **Scenarios**. Preserve all existing
functionality; migrate data forward; no user-visible regressions.

The additional "master data model" suggestion is folded in: entities
(assets/holdings, properties, income sources, pensions, assumptions) become
canonical rows in a single graph. Every module — dashboard, retirement,
scenarios, AI, future tax/estate — reads from that graph. This is the
architectural spine.

---

## 1. Conceptual model (single source of truth)

```text
                 ┌──────────────────────┐
                 │  Current Reality     │  facts, dated
                 │  (entities + snaps)  │
                 └──────────┬───────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
   ┌─────────▼─────────┐         ┌─────────▼─────────┐
   │ Planning          │         │ App Settings      │
   │ Assumptions       │         │ (theme, currency  │
   │ (baseline, one    │         │  display, AI cfg) │
   │  row per key)     │         └───────────────────┘
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ Scenarios         │  store ONLY overrides
   │ (sparse diffs on  │  vs baseline assumptions
   │  baseline)        │
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ Retirement Engine │  pure fn: (reality, assumptions, overrides) → results
   └─────────┬─────────┘
             │
   ┌─────────▼─────────┐
   │ Dashboard · AI ·  │  read-only consumers
   │ Reports · Reviews │
   └───────────────────┘
```

Rules that fall out of this:
- Scenarios never mutate baseline assumptions.
- AI never computes numbers — it consumes engine output as JSON.
- Every asset/property/income/pension exists once, referenced everywhere.

---

## 2. Data-model changes

New / renamed tables (all in same migration batch, with GRANTs + RLS per
existing pattern):

- `planning_assumptions` — one row per assumption key, per user. Columns:
  `key` (enum, e.g. `inflation.uk`, `growth.equity_real`, `retirement.target_age`,
  `spending.core`, `property.sale_year`, `state_pension.amount`, …),
  `value_numeric`, `value_json` (for structured ones), `unit`, `confidence`
  (`high|medium|low`), `source`, `description`, `last_reviewed_at`,
  `review_due_at`, `ai_commentary`.
- `planning_assumption_history` — append-only change log
  (`assumption_id, old_value, new_value, changed_at, note`).
- `scenario_overrides` — replaces the current "clone assumptions JSON"
  approach. Columns: `scenario_id, assumption_key, value_numeric,
  value_json, note`. Sparse.
- `app_settings` — narrow table for pure app config
  (`theme, base_currency, alt_currency, ai_personality, dashboard_layout`).
  Migrated from current `user_settings` + `profiles` split; planning-shaped
  fields move out into `planning_assumptions`.

Kept as-is (already canonical): `holdings`, `property_assets`,
`income_sources`, `retirement_plans` (demoted to "profile + target date"
only — the numeric assumptions inside it migrate to `planning_assumptions`),
`valuation_snapshots`, `snapshot_holdings`, `documents`, `scenarios`,
`ai_*`, `fx_rates`, `user_roles`.

Migration: read current `user_settings.assumptions` JSON + relevant
`retirement_plans` fields and seed one `planning_assumptions` row per key
per user. Then drop the JSON blob.

---

## 3. Code reorganisation

```text
src/lib/
  reality/        # queries over canonical entity tables (holdings, property, income, pensions, snapshots)
  assumptions/    # CRUD + confidence + history for planning_assumptions
  scenarios/      # CRUD + override merge (baseline ⊕ overrides → resolved set)
  engine/         # pure calculators: projection, RPPI, FIRE, confidence scores
  ai/             # gateway client + prompt templates; consumes engine output only
  settings/       # app_settings only (theme/currency-display/AI cfg)
```

- `src/lib/finance/calculators.ts` → `src/lib/engine/` (split by concern).
- Existing `settings.functions.ts` splits into `settings.functions.ts`
  (app settings) and `assumptions.functions.ts` (planning).
- `retirement.functions.ts` becomes a thin caller of `engine/`.
- Dedup: one `KpiCard`, one `ChartShell`, one number-formatter, one
  currency-conversion helper. Audit and remove duplicates.

Naming pass: `plan` (retirement profile) vs `assumption` (single value) vs
`scenario` (override set) — enforced consistently in table names, server
fns, and UI copy.

---

## 4. Retirement engine (pure)

Signature:
```ts
runProjection({
  reality: RealitySnapshot,          // assets + income + property today
  baseline: ResolvedAssumptions,     // all planning assumptions
  overrides?: ScenarioOverrides,     // sparse
}): ProjectionResult
```
Returns: year-by-year portfolio + income + spending in nominal and real
terms, sustainable income, depletion year, FIRE %, **RPPI** (Retirement
Purchasing Power Index = real sustainable income ÷ target real spend,
FX-adjusted for primary spending currency), retirement confidence score,
and assumption-confidence score (weighted avg of confidence tags on the
assumptions the result depends on most).

All existing calculators are replaced by / wrapped inside this engine so
Dashboard, Retirement, and Scenarios all call the same function.

---

## 5. UI changes

- **Dashboard**: unchanged in spirit — today's position only. Adds RPPI
  card and Assumption-Confidence badge next to Retirement Confidence. Any
  KPI derived from assumptions gets a small "based on assumptions" tag
  linking to the Assumptions Centre.
- **Settings** page: slimmed to true app settings only (theme, display
  currency, alt currency, AI personality). Planning fields removed with an
  inline notice: "Moved to Planning Assumptions".
- **Planning Assumptions Centre** (new route `/assumptions`): grouped
  accordion (Inflation, Investment, Currency, Retirement, Spending,
  Property, State Pension, Consulting). Each row: value, unit, confidence
  pill, last-reviewed, review-due, source, description, AI commentary,
  history drawer. Bulk "mark reviewed" action.
- **Scenarios**: rebuilt as override editor. Left column = baseline value,
  right column = override (empty = inherit). Impact summary + comparison
  vs baseline + AI commentary. No more assumption cloning.
- **Retirement**: keeps target-date/profile fields; numeric knobs move to
  Assumptions.
- **Nav**: add Assumptions; keep Scenarios; everything else unchanged.

Every chart keeps its one-line caption. Every number stays clickable for
explanation (existing pattern extended).

---

## 6. AI boundaries (unchanged principle, tightened wiring)

AI receives structured JSON from `engine/` + `reality/` + `assumptions/`.
Prompt templates centralised under `src/lib/ai/prompts/`. New commentary
targets: per-assumption (`ai_commentary` column), per-scenario, quarterly
review. No AI code path calls a calculator directly.

---

## 7. What is explicitly NOT in this refactor

Tax, Estate, Insurance, Healthcare, Currency Planning, Investment
Committee, Document Intelligence, Goal Planning, Retirement Checklists.
The schema and module registry leave room for them; no UI or logic ships.

Document library stays as it is today; AI-over-documents (RAG) is deferred.

Multi-currency spending buckets are supported by the assumption schema
(spending keys can carry a currency) but no new spending UI ships beyond
what's needed to edit the assumptions.

---

## 8. Delivery order (single PR, staged commits)

1. Migration: new tables + backfill from existing JSON/settings + GRANTs + RLS.
2. `src/lib/engine/` + `assumptions/` + `scenarios/` server fns; unit-test
   the engine against current dashboard/retirement numbers to prove parity.
3. Refactor Dashboard + Retirement + Scenarios to call the engine.
4. Ship Assumptions Centre UI; slim Settings; rebuild Scenario editor.
5. Dedup pass (components, formatters, fx helpers); rename pass.
6. Typecheck + manual walkthrough of every existing screen; confirm no
   regressions in KPIs, retirement projection, import flow, FX display.

---

## 9. Open questions before I start

1. **RPPI target currency.** Should RPPI be expressed in your primary
   *spending* currency (which may differ from base reporting currency
   GBP)? I'd add a `primary_spending_currency` app setting and default it
   to GBP.
2. **State Pension / Consulting** — currently modelled in `income_sources`.
   Keep them there (canonical entity) and let the relevant *assumptions*
   (indexation, probability, start date) live in `planning_assumptions`
   referencing the source id? That's my recommendation — keeps the
   "entity exists once" rule intact.
3. **Migration risk.** Backfilling assumptions from the existing JSON
   blob is lossy if you've customised anything unusual. OK for me to log
   the pre-migration blob into `planning_assumption_history` as the
   initial "source" so nothing is lost?
4. **Scope check.** Is it acceptable that Scenarios' UI changes shape
   (override-only editor) — existing saved scenarios would be migrated to
   overrides where they differ from the new baseline, but the editing UX
   is different?

Reply with answers (or "go" to accept my recommendations on all four) and
I'll execute the plan in order.
