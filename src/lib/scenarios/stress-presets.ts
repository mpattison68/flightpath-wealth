// One-click stress test presets. Each preset is a bag of ephemeral overrides
// applied on top of a scenario before its projection is re-run.

export type StressPreset = {
  key: string;
  label: string;
  description: string;
  overrides: Record<string, number>;
};

export const STRESS_PRESETS: StressPreset[] = [
  { key: "market_crash_20", label: "20% Market Crash", description: "20% loss in year 1.", overrides: { "stress.market_shock_year": 1, "stress.market_shock_pct": -20 } },
  { key: "market_crash_40", label: "40% Market Crash", description: "40% loss in year 1.", overrides: { "stress.market_shock_year": 1, "stress.market_shock_pct": -40 } },
  { key: "bear_five_year", label: "Five-Year Bear Market", description: "-2% real for five years.", overrides: { "stress.bear_years": 5, "stress.bear_return": -2 } },
  { key: "inflation_decade", label: "High Inflation Decade", description: "Target inflation +3% for a decade (proxy).", overrides: { "inflation.target": 8.5 } },
  { key: "healthcare_crisis", label: "Healthcare Crisis", description: "Medical spending +50%.", overrides: { "spending.multiplier": 1.15, "inflation.healthcare": 12 } },
  { key: "property_low", label: "Property Sells Below Expectation", description: "Reinvest 60% of net proceeds only.", overrides: { "property.reinvest_pct": 60 } },
  { key: "state_pension_delay", label: "State Pension Delayed", description: "State pension starts 3 years later.", overrides: { "state_pension.delay_years": 3 } },
  { key: "consulting_lost", label: "Consulting Income Lost", description: "No consulting income materialises.", overrides: { "consulting.probability": 0 } },
  { key: "longevity_100", label: "Longevity to Age 100", description: "Plan to age 100.", overrides: { "retirement.life_expectancy": 100 } },
  { key: "rand_weakens", label: "Rand Weakens Sharply", description: "Currency drift +6%/yr.", overrides: { "fx.drift": 6 } },
];

export function findPreset(key: string): StressPreset | undefined {
  return STRESS_PRESETS.find((p) => p.key === key);
}