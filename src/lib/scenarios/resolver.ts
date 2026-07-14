// Merges baseline assumptions with per-scenario overrides into the flat
// `ProjectionInputs` the projection engine consumes. Overrides can come
// from three layers, applied in order:
//   1. Baseline assumptions (planning_assumptions rows)
//   2. Scenario overrides (scenario_overrides rows)
//   3. Ephemeral stress-test overrides (from STRESS_PRESETS)
//
// Only overridden values are stored per scenario — everything else
// falls through to the baseline.

import { baseInputs, type ProjectionInputs } from "@/lib/finance/projection";

export type AssumptionValue = { key: string; value_numeric: number | null };
export type OverrideValue = { assumption_key: string; value_numeric: number | null };

export type ResolveContext = {
  currentAge: number;
  startYear: number;
  portfolio: number;
  property: number;
  cash: number;
  spendingTarget: number;   // annual, Target Currency
  fxSpot: number;
  vehicleType?: ProjectionInputs["vehicleType"];
};

function toMap(rows: { key: string; value_numeric: number | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) if (r.value_numeric != null) m.set(r.key, Number(r.value_numeric));
  return m;
}

export function resolveProjectionInputs(args: {
  ctx: ResolveContext;
  assumptions: AssumptionValue[];
  overrides: OverrideValue[];
  extra?: Record<string, number>;   // e.g. stress preset numbers
  vehicleType?: ProjectionInputs["vehicleType"];
}): ProjectionInputs {
  const base = toMap(args.assumptions);
  const scen = new Map<string, number>();
  for (const o of args.overrides) if (o.value_numeric != null) scen.set(o.assumption_key, Number(o.value_numeric));
  const extra = new Map<string, number>(Object.entries(args.extra ?? {}));

  const get = (key: string, fallback: number): number => {
    if (extra.has(key)) return extra.get(key)!;
    if (scen.has(key)) return scen.get(key)!;
    if (base.has(key)) return base.get(key)!;
    return fallback;
  };

  const inputs = baseInputs();
  inputs.currentAge = args.ctx.currentAge;
  inputs.startYear = args.ctx.startYear;
  inputs.portfolio = args.ctx.portfolio;
  inputs.property = args.ctx.property;
  inputs.cash = args.ctx.cash;
  inputs.fxSpot = args.ctx.fxSpot;

  inputs.retirementAge = get("retirement.target_age", 60) + get("timing.retirement_year_delta", 0);
  inputs.planningHorizonAge = get("retirement.life_expectancy", 92);

  inputs.equityRealPct = get("growth.equity_real", 4);
  inputs.bondRealPct = get("growth.bond_real", 1);
  inputs.equityPct = get("allocation.equity_pct", 70);

  inputs.swrPct = get("withdrawal.swr", 3.5);

  inputs.annualSpendingTarget = args.ctx.spendingTarget;
  inputs.spendingMultiplier = get("spending.multiplier", 1);
  inputs.targetInflationPct = get("inflation.target", get("inflation.uk", 2.5));

  inputs.fxDriftPct = get("fx.drift", get("fx.gbpzar_trend", 0));

  inputs.statePensionAnnualInv = get("state_pension.amount", 0) * (get("state_pension.confidence", 100) / 100);
  inputs.statePensionStartYear = get("state_pension.start_date", args.ctx.startYear + 10) + get("state_pension.delay_years", 0);

  inputs.consultingAnnualInv = get("consulting.annual_income", 0);
  inputs.consultingStartYear = get("consulting.start", args.ctx.startYear);
  inputs.consultingDurationYears = get("consulting.duration", 0);
  inputs.consultingProbabilityPct = get("consulting.probability", 100);

  const saleYearBase = get("property.sale_year", 2999);
  const saleDelta = get("property.sale_year_delta", 0);
  inputs.propertySaleYear = saleYearBase + saleDelta;
  inputs.propertyRealGrowthPct = get("growth.property_real", 1);
  inputs.propertyReinvestPct = get("property.reinvest_pct", 100);
  inputs.propertySellingCostsPct = get("property.selling_costs", 3);

  inputs.targetLegacyTgt = get("retirement.legacy", 0);
  inputs.cashReserveTgt = get("retirement.cash_reserve", 0);

  inputs.marketShockYear = get("stress.market_shock_year", 0);
  inputs.marketShockPct = get("stress.market_shock_pct", 0);
  inputs.bearYears = get("stress.bear_years", 0);
  inputs.bearReturnPct = get("stress.bear_return", 0);

  inputs.taxRatePct = get("tax.marginal_rate", 0);

  inputs.vehicleType = args.vehicleType ?? "invested";
  inputs.drawdownPct = get("vehicle.drawdown_pct", 4.5);
  inputs.annuityRatePct = get("vehicle.annuity_rate", 6.5);
  inputs.blendPct = get("vehicle.blend_pct", 50);

  return inputs;
}

// A flat list of override keys the builder should surface, grouped for the UI.
export const OVERRIDE_FIELDS: {
  group: string;
  fields: { key: string; label: string; unit: string; hint?: string }[];
}[] = [
  { group: "Timing", fields: [
    { key: "timing.retirement_year_delta", label: "Shift Retirement (years)", unit: "yrs", hint: "Negative retires earlier, positive later." },
    { key: "retirement.life_expectancy", label: "Planning Horizon (age)", unit: "age" },
    { key: "property.sale_year", label: "Property Sale Year", unit: "year" },
    { key: "property.sale_year_delta", label: "Shift Property Sale (years)", unit: "yrs" },
  ]},
  { group: "Investment", fields: [
    { key: "growth.equity_real", label: "Equity Real Return", unit: "%" },
    { key: "growth.bond_real", label: "Bond Real Return", unit: "%" },
    { key: "growth.property_real", label: "Property Real Growth", unit: "%" },
    { key: "allocation.equity_pct", label: "Equity Allocation", unit: "%" },
    { key: "withdrawal.swr", label: "Safe Withdrawal Rate", unit: "%" },
  ]},
  { group: "Currency & Inflation", fields: [
    { key: "inflation.target", label: "Target-Currency Inflation", unit: "%" },
    { key: "inflation.healthcare", label: "Healthcare Inflation", unit: "%" },
    { key: "fx.drift", label: "Currency Drift (Inv→Tgt)", unit: "%/yr" },
  ]},
  { group: "Spending", fields: [
    { key: "spending.multiplier", label: "Spending Multiplier", unit: "×", hint: "1.0 = today's spend, 1.15 = +15%." },
    { key: "retirement.legacy", label: "Target Legacy (Tgt)", unit: "" },
    { key: "retirement.cash_reserve", label: "Cash Reserve (Tgt)", unit: "" },
  ]},
  { group: "Income Engines", fields: [
    { key: "state_pension.amount", label: "State Pension (Inv/yr)", unit: "" },
    { key: "state_pension.start_date", label: "State Pension Start Year", unit: "year" },
    { key: "state_pension.confidence", label: "State Pension Confidence", unit: "%" },
    { key: "consulting.annual_income", label: "Consulting Income (Inv/yr)", unit: "" },
    { key: "consulting.duration", label: "Consulting Duration", unit: "yrs" },
    { key: "consulting.probability", label: "Consulting Probability", unit: "%" },
  ]},
  { group: "Retirement Vehicle", fields: [
    { key: "vehicle.drawdown_pct", label: "Drawdown Rate", unit: "%" },
    { key: "vehicle.annuity_rate", label: "Annuity Rate", unit: "%" },
    { key: "vehicle.blend_pct", label: "Blended Annuity %", unit: "%" },
  ]},
  { group: "Tax (Reserved)", fields: [
    { key: "tax.marginal_rate", label: "Marginal Tax Rate", unit: "%" },
    { key: "tax.cgt_pct", label: "CGT Rate", unit: "%" },
  ]},
];