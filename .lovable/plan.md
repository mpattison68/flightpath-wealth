## Phase 2 Architecture Review — Implementation Plan

A large, coherent set of changes. I'll deliver them in **four staged migrations + code batches** so each stage is reviewable and reversible. Nothing here rebuilds existing architecture — every change extends the "single source of truth" model already in place (`planning_assumptions`, `scenario_overrides`, pure calculators).

---

### Stage A — Data model foundations (one migration)

New tables and columns, all following existing conventions (RLS scoped to `auth.uid()`, GRANTs, `updated_at` triggers):

- `financial_engines` — canonical list of income engines per user (`kind`: portfolio | property | state_pension | private_pension | consulting | rental | annuity, `label`, `status`: active/planned/future, `starts_on`, `ends_on`, `metadata jsonb`). Seeds one row per engine on first load.
- `retirement_income_sources` — per-engine income stream detail (`engine_id`, `gross_amount`, `currency`, `indexation_method`, `confidence`, `country`, `review_date`). Replaces free-form `income_sources` usage going forward; existing rows migrated in-place with an `engine_id` FK (nullable during transition).
- `spending_categories` — 13 categories from the brief, each tagged `rollup`: core | lifestyle, `essential` boolean. Seeded per user.
- `planning_milestones` — `kind`, `label`, `target_date`, `achieved_on`, `source` (derived vs manual). Derived milestones (FIRE achieved, Mortgage cleared, etc.) computed on read; manual ones stored.
- `property_assets` — add `property_type` (primary/investment/holiday/rental), `expected_sale_year`, `selling_costs_pct`, `estimated_tax`, `mortgage_balance`, `expected_net_proceeds` (computed).
- `planning_assumptions` — add `review_frequency` (quarterly/six_monthly/annually/never), `next_review_at` (computed from `last_reviewed_at + frequency`), `depends_on text[]` (keys of related assumptions).
- `user_settings` — add `primary_spending_currency` (already partially present per Stage 1 note; verify + expose in Settings).

### Stage B — Assumption intelligence

- **Dependency graph** in `src/lib/assumptions/dependencies.ts` — static map of key → related keys (retirement_age → [state_pension_start, consulting_start/end, property_sale_year, planning_horizon]; sa_inflation → [healthcare_inflation, gbp_zar, spending_*]; property_sale_year → [property_value, mortgage, selling_costs, estimated_tax]; portfolio_return → [swr, planning_horizon]).
- On assumption save: show a toast + inline "Related assumptions to review" panel with one-click "Mark reviewed" per dependent.
- **Review frequency** control added to each assumption row; badge on rows past due.

### Stage C — Retirement engine rewrite (pure calculators, no UI churn)

- `src/lib/finance/engines.ts` — one function per engine kind returning `{ year, gross, net, currency }[]` streams.
- `src/lib/finance/retirement-engine.ts` — composes engine streams + spending needs into:
  - `guaranteedIncome(year)` (state pension + annuities + confirmed rental)
  - `expectedIncome(year)` (adds probability-weighted consulting)
  - `requiredPortfolioIncome = targetSpending − guaranteedIncome − expectedIncome`
  - `dynamicFireTarget = requiredPortfolioIncome / SWR` (replaces static `fire_target` / `liquid_fire_target` assumptions — old keys kept as manual overrides but hidden by default).
- Dashboard, Retirement, Scenarios read these instead of static assumption values. Static keys deprecated in the assumptions UI with a "Now calculated" pill linking to the source inputs.

### Stage D — UI surfaces (progressive disclosure, no new nav noise)

- **Settings** — add `Primary Spending Currency` field between Base and Alternative currency, with tooltip explaining its purpose.
- **Dashboard** — one new card: **Review Centre**. Compact list: Assumptions due (n), Portfolio review due, Property valuation due, Tax review due (placeholder), Estate review (placeholder), Investment review due. Each item links to its module. Uses existing card styling.
- **Retirement page** — three additions inside existing layout, no new routes:
  1. **Engines strip** above KPIs — one small tile per active engine showing its projected annual contribution at retirement.
  2. **Timeline** below the flightpath chart — horizontal line with milestone markers (property sale, retirement, consulting start/end, state pension, FIRE achieved). Uses recharts scatter on a hidden axis for consistency.
  3. **Dynamic FIRE target** shown as calculated value with breakdown tooltip (spending − guaranteed − expected → required capital).
- **New route `/_authenticated/spending`** (added to sidebar under Retirement group) — the 13 categories, grouped by rollup, with Core/Lifestyle/Total totals. Same accordion pattern as Assumptions.
- **Property page** (existing) — add property_type selector and the new sale-planning fields; expected_net_proceeds shown live.
- **Retirement Income section** — new subsection on the Retirement page (not a new route) listing income sources grouped by engine.

### Stage E — Future-proofing (no user-visible change)

- `src/modules/registry.ts` — declare `tax`, `estate`, `insurance`, `healthcare`, `documents`, `committee`, `adviser` as `status: "planned"` with target engine mappings. Registry already supports this pattern.
- Add `src/lib/finance/README.md` documenting the engine contract so future modules plug in without rework.

---

### What I will NOT do

- No visual redesign, no new global navigation, no colour changes.
- No AI logic changes (still summarisation only).
- No removal of existing assumption keys — deprecated ones stay readable so scenarios/history remain valid.
- No implementation of Tax, Estate, Insurance, Healthcare, Document Intelligence, Committee, or Adviser modules — only registry entries.

### Order of execution

1. Stage A migration (single SQL) → wait for approval.
2. Stages B–E code batches in that order, each verified with a build before moving on.
3. Update the draft manual and regenerate the PDF at the end.

Reply **"go"** to run the Stage A migration, or tell me which stages to reorder / drop.
