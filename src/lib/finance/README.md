# Finance module contract

Every number surfaced in the app must originate from a pure function under
`src/lib/finance/`. AI never computes numbers — it only narrates them.

## Single source of truth

- `holdings`, `property_assets`, `retirement_income_sources`, `spending_categories`,
  `planning_assumptions`, `financial_engines` — the canonical persisted state.
- Calculators read from these tables and produce derived values on demand.
- Scenarios apply sparse overrides on top of assumptions; they never mutate
  the baseline.

## Financial engines

Retirement is not funded by "a portfolio" alone. It is funded by several
independent engines working together:

| Kind              | Fuels retirement by |
| ----------------- | ------------------- |
| `portfolio`       | Drawing down liquid investments at the SWR |
| `property`        | Releasing capital on planned sale, or net rental |
| `state_pension`   | Guaranteed indexed income from start date |
| `private_pension` | Occupational / personal pension income |
| `consulting`      | Time-limited earned income after career |
| `rental`          | Net rental from investment property |
| `annuity`         | Guaranteed lifetime income products |

A new module should:

1. Persist its inputs in a dedicated table with RLS and GRANTs.
2. Expose a pure calculator returning `{ year, gross, net, currency }[]`.
3. Register a `financial_engines` row so it appears in the Retirement UI.
4. Add relevant assumptions to `planning_assumptions` with a
   `review_frequency` and `depends_on` entries.

## Dynamic FIRE

```
targetSpending − guaranteedIncome − expectedIncome
= requiredPortfolioIncome
÷ SWR
= requiredCapital (dynamic FIRE target)
```

This value replaces the old static `fire.target_total` assumption. The old
key is kept in the catalogue as a manual reference only.

## Future modules

Tax, Estate, Insurance, Healthcare, Documents, and the Investment Committee
each consume the same engines. The data model is deliberately future-proofed
so those modules can plug in without changing existing tables.