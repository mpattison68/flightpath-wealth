// Deterministic finance calculators. Pure functions only — no I/O, no AI.
// Every number in the app should originate here.

export type Holding = {
  value: number;
  asset_class?: string | null;
  region?: string | null;
  currency?: string | null;
  liquidity?: string | null;
  wrapper?: string | null;
};

export type Assumptions = {
  inflation_pct: number;
  real_growth_pct: number;
  swr_pct: number;
  life_expectancy: number;
  fire_target: number;
  liquid_fire_target: number;
};

export function sumValue(items: { value: number }[]): number {
  return items.reduce((acc, h) => acc + (Number(h.value) || 0), 0);
}

export function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item) || "Unspecified";
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

export function allocation(holdings: Holding[], dim: keyof Holding) {
  const total = sumValue(holdings);
  const groups = groupBy(holdings, (h) => String(h[dim] ?? "Unspecified"));
  return Object.entries(groups)
    .map(([name, items]) => {
      const value = sumValue(items);
      return { name, value, pct: total > 0 ? (value / total) * 100 : 0 };
    })
    .sort((a, b) => b.value - a.value);
}

export function liquidValue(holdings: Holding[]): number {
  return sumValue(holdings.filter((h) => (h.liquidity ?? "liquid") === "liquid"));
}

// Safe Withdrawal Rate: annual sustainable income from a portfolio.
export function sustainableIncome(portfolio: number, swrPct: number): number {
  return portfolio * (swrPct / 100);
}

// FIRE progress as a percentage of target.
export function fireProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (current / target) * 100);
}

// Years between two dates (positive if `to` is after `from`).
export function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 3600 * 1000);
}

// Future value with constant real growth (real terms — inflation netted out).
export function projectFutureValue(
  presentValue: number,
  annualContribution: number,
  years: number,
  realGrowthPct: number,
): number {
  const r = realGrowthPct / 100;
  if (years <= 0) return presentValue;
  if (Math.abs(r) < 1e-9) return presentValue + annualContribution * years;
  const fv = presentValue * Math.pow(1 + r, years);
  const annuity = annualContribution * ((Math.pow(1 + r, years) - 1) / r);
  return fv + annuity;
}

// Retirement readiness score 0-100 — combines FIRE progress and income coverage.
export function readinessScore(params: {
  current: number;
  fireTarget: number;
  projectedAtRetirement: number;
  desiredIncome: number;
  swrPct: number;
}): number {
  const fire = fireProgress(params.current, params.fireTarget);
  const income = sustainableIncome(params.projectedAtRetirement, params.swrPct);
  const incomeCover = params.desiredIncome > 0
    ? Math.min(100, (income / params.desiredIncome) * 100)
    : 100;
  return Math.round(0.4 * fire + 0.6 * incomeCover);
}

// -------- Dynamic FIRE ---------------------------------------------------
// FIRE capital is what the portfolio must supply after guaranteed and
// expected income streams have covered part of target spending.

export type DynamicFireInputs = {
  targetSpending: number;      // annual, real, base currency
  guaranteedIncome: number;    // annual, real (state pension, annuities, confirmed rental)
  expectedIncome: number;      // annual, real, probability-weighted (consulting, uncertain rental)
  swrPct: number;
};

export type DynamicFireResult = {
  targetSpending: number;
  guaranteedIncome: number;
  expectedIncome: number;
  requiredPortfolioIncome: number;
  requiredCapital: number;
};

export function dynamicFireTarget(i: DynamicFireInputs): DynamicFireResult {
  const required = Math.max(0, i.targetSpending - i.guaranteedIncome - i.expectedIncome);
  const capital = i.swrPct > 0 ? required / (i.swrPct / 100) : 0;
  return {
    targetSpending: i.targetSpending,
    guaranteedIncome: i.guaranteedIncome,
    expectedIncome: i.expectedIncome,
    requiredPortfolioIncome: required,
    requiredCapital: capital,
  };
}