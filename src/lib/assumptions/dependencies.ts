// Static graph of assumption dependencies. When the user changes an
// assumption, the app suggests reviewing related ones. Purely advisory —
// no calculation impact.

export const ASSUMPTION_DEPENDENCIES: Record<string, string[]> = {
  "retirement.target_age": [
    "state_pension.start_date",
    "consulting.start",
    "consulting.duration",
    "property.sale_year",
    "retirement.horizon",
  ],
  "retirement.horizon": ["retirement.life_expectancy", "withdrawal.swr"],
  "inflation.za": [
    "inflation.healthcare",
    "fx.gbpzar_trend",
    "spending.core",
    "spending.lifestyle",
  ],
  "inflation.uk": ["spending.core", "spending.lifestyle", "withdrawal.swr"],
  "property.sale_year": [
    "property.sale_price",
    "property.mortgage_balance",
    "property.selling_costs",
    "property.tax",
  ],
  "growth.equity_real": [
    "withdrawal.swr",
    "retirement.horizon",
  ],
  "growth.property_real": ["property.sale_price"],
  "withdrawal.swr": ["retirement.horizon", "retirement.life_expectancy"],
  "state_pension.amount": ["state_pension.confidence", "state_pension.indexation"],
  "consulting.annual_income": ["consulting.probability", "consulting.duration"],
};

export function relatedTo(key: string): string[] {
  const direct = ASSUMPTION_DEPENDENCIES[key] ?? [];
  // Also include reverse edges — if A lists B, changing B affects A.
  const reverse = Object.entries(ASSUMPTION_DEPENDENCIES)
    .filter(([, deps]) => deps.includes(key))
    .map(([k]) => k);
  return Array.from(new Set([...direct, ...reverse]));
}