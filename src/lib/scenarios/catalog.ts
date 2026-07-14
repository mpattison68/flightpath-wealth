// Catalogue of scenario categories and subtypes. Categories are the
// top-level grouping in the library; subtypes are pre-baked templates that
// pre-fill overrides in the builder. Users are free to add fully custom
// scenarios of any type.

export type ScenarioCategory =
  | "retirement_timing"
  | "investment_strategy"
  | "vehicle"
  | "spending"
  | "economic"
  | "tax";

export type ScenarioSubtype = {
  key: string;
  label: string;
  description: string;
  // Suggested overrides applied when creating from this template.
  overrides: Record<string, number | string>;
};

export const SCENARIO_CATEGORIES: {
  key: ScenarioCategory;
  label: string;
  description: string;
  subtypes: ScenarioSubtype[];
}[] = [
  {
    key: "retirement_timing",
    label: "Retirement Timing",
    description: "When you stop working and how you transition out.",
    subtypes: [
      { key: "retire_earlier", label: "Retire Earlier", description: "Pull retirement forward by 3 years.", overrides: { "timing.retirement_year_delta": -3 } },
      { key: "retire_later", label: "Retire Later", description: "Push retirement back by 3 years.", overrides: { "timing.retirement_year_delta": 3 } },
      { key: "phased_retirement", label: "Phased Retirement", description: "Reduce hours, extend consulting.", overrides: { "consulting.duration": 8 } },
      { key: "immediate_retirement", label: "Immediate Retirement", description: "Retire this year.", overrides: { "timing.retirement_year_delta": -99 } },
      { key: "consulting_transition", label: "Consulting Transition", description: "Long consulting bridge into retirement.", overrides: { "consulting.duration": 10, "consulting.probability": 90 } },
    ],
  },
  {
    key: "investment_strategy",
    label: "Investment Strategy",
    description: "How the portfolio is allocated and what returns to expect.",
    subtypes: [
      { key: "higher_equity", label: "Higher Equity Allocation", description: "Tilt to equities for growth.", overrides: { "allocation.equity_pct": 85, "growth.equity_real": 5.0 } },
      { key: "lower_equity", label: "Lower Equity Allocation", description: "Reduce equity for stability.", overrides: { "allocation.equity_pct": 40, "growth.equity_real": 3.0 } },
      { key: "income_portfolio", label: "Income Portfolio", description: "Income-focused blend.", overrides: { "growth.equity_real": 3.0, "withdrawal.swr": 4.0 } },
      { key: "growth_portfolio", label: "Growth Portfolio", description: "Aggressive real growth.", overrides: { "growth.equity_real": 5.5, "allocation.equity_pct": 90 } },
      { key: "defensive_portfolio", label: "Defensive Portfolio", description: "Preserve capital, lower growth.", overrides: { "growth.equity_real": 2.5, "allocation.equity_pct": 30 } },
      { key: "property_retained", label: "Property Retained", description: "Do not sell the property.", overrides: { "property.sale_year": 2999 } },
      { key: "property_sold_early", label: "Property Sold Early", description: "Sell in 3 years, reinvest.", overrides: { "property.sale_year_delta": -5 } },
      { key: "property_downsized", label: "Property Downsized", description: "Sell and buy smaller.", overrides: { "property.sale_year_delta": 0, "property.reinvest_pct": 60 } },
    ],
  },
  {
    key: "vehicle",
    label: "Retirement Vehicle",
    description: "How retirement income is structured. Educational — not regulated advice.",
    subtypes: [
      { key: "remain_invested", label: "Remain Invested", description: "Stay fully invested, drawdown at SWR.", overrides: { "vehicle.type": "invested" } },
      { key: "living_annuity", label: "Living Annuity", description: "Flexible drawdown, capital preserved.", overrides: { "vehicle.type": "living_annuity", "vehicle.drawdown_pct": 4.5 } },
      { key: "guaranteed_annuity", label: "Guaranteed Life Annuity", description: "Guaranteed income for life.", overrides: { "vehicle.type": "guaranteed_annuity", "vehicle.annuity_rate": 6.5 } },
      { key: "blended_annuity", label: "Blended Strategy", description: "Half guaranteed, half invested.", overrides: { "vehicle.type": "blended", "vehicle.blend_pct": 50 } },
      { key: "pension_drawdown", label: "Pension Drawdown", description: "Draw from pension pot.", overrides: { "vehicle.type": "drawdown", "vehicle.drawdown_pct": 4.0 } },
    ],
  },
  {
    key: "spending",
    label: "Spending Strategy",
    description: "How your target lifestyle changes retirement outcomes.",
    subtypes: [
      { key: "higher_spending", label: "Higher Spending", description: "Lifestyle costs +15%.", overrides: { "spending.multiplier": 1.15 } },
      { key: "lower_spending", label: "Lower Spending", description: "Lifestyle costs -15%.", overrides: { "spending.multiplier": 0.85 } },
      { key: "luxury_retirement", label: "Luxury Retirement", description: "Premium lifestyle target.", overrides: { "spending.multiplier": 1.35 } },
      { key: "essential_only", label: "Essential Only", description: "Core spending only.", overrides: { "spending.multiplier": 0.65 } },
      { key: "travel_focus", label: "Travel Focus", description: "Higher discretionary travel budget.", overrides: { "spending.multiplier": 1.1, "spending.category.travel": 300000 } },
      { key: "healthcare_focus", label: "Healthcare Focus", description: "Elevated healthcare provisioning.", overrides: { "spending.multiplier": 1.05, "spending.category.medical": 300000 } },
      { key: "legacy_focus", label: "Legacy Focus", description: "Constrain spending to leave a legacy.", overrides: { "spending.multiplier": 0.9, "retirement.legacy": 5000000 } },
    ],
  },
  {
    key: "economic",
    label: "Economic Scenario",
    description: "External economic conditions shift.",
    subtypes: [
      { key: "high_inflation", label: "High Inflation", description: "Target inflation runs at 8%.", overrides: { "inflation.target": 8.0 } },
      { key: "low_inflation", label: "Low Inflation", description: "Inflation stays at 2%.", overrides: { "inflation.target": 2.0 } },
      { key: "strong_equity", label: "Strong Equity Markets", description: "Equities return 6% real.", overrides: { "growth.equity_real": 6.0 } },
      { key: "weak_equity", label: "Weak Equity Markets", description: "Equities return 2% real.", overrides: { "growth.equity_real": 2.0 } },
      { key: "recession", label: "Global Recession", description: "20% shock in year 1, slow recovery.", overrides: { "stress.market_shock_year": 1, "stress.market_shock_pct": -20 } },
      { key: "extended_bear", label: "Extended Bear Market", description: "Five weak years then recovery.", overrides: { "stress.bear_years": 5, "stress.bear_return": -2 } },
      { key: "property_boom", label: "Property Boom", description: "Property outperforms.", overrides: { "growth.property_real": 4.0 } },
      { key: "property_crash", label: "Property Crash", description: "Property lags inflation.", overrides: { "growth.property_real": -2.0 } },
      { key: "rand_strengthens", label: "Rand Strengthens", description: "GBP/ZAR drift -3%.", overrides: { "fx.drift": -3.0 } },
      { key: "rand_weakens", label: "Rand Weakens", description: "GBP/ZAR drift +6%.", overrides: { "fx.drift": 6.0 } },
      { key: "healthcare_shock", label: "Healthcare Inflation Shock", description: "Healthcare inflation +8%.", overrides: { "inflation.healthcare": 12.0 } },
    ],
  },
  {
    key: "tax",
    label: "Tax Strategy",
    description: "Placeholder for the future Tax Flightpath module.",
    subtypes: [
      { key: "future_tax_rates", label: "Future Tax Rate Changes", description: "Model higher personal tax.", overrides: { "tax.marginal_rate": 45 } },
      { key: "cgt_outcome", label: "Different CGT Outcome", description: "Higher CGT on property sale.", overrides: { "tax.cgt_pct": 30 } },
    ],
  },
];

export function findSubtype(subtype: string | null | undefined): ScenarioSubtype | null {
  if (!subtype) return null;
  for (const c of SCENARIO_CATEGORIES) {
    const s = c.subtypes.find((x) => x.key === subtype);
    if (s) return s;
  }
  return null;
}

export function categoryLabel(type: string): string {
  return SCENARIO_CATEGORIES.find((c) => c.key === type)?.label ?? type;
}