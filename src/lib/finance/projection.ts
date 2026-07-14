// Deterministic year-by-year retirement projection engine.
//
// Pure function — same inputs always produce same outputs. The scenario
// engine merges baseline assumptions with per-scenario overrides, then
// hands the flat resolved inputs to `runProjection`.
//
// Two Worlds Model:
//   * Wealth (portfolio, property, cash) is tracked in Investment Currency.
//   * Retirement lifestyle (spending, sustainable income, purchasing power)
//     is tracked in Target Currency.
// Every year computes both, plus a Retirement Purchasing Power Index (RPPI).

export type ProjectionInputs = {
  currentAge: number;
  retirementAge: number;
  planningHorizonAge: number;         // e.g. 95
  startYear: number;                  // absolute calendar year of "now"

  // Wealth today (Investment Currency).
  portfolio: number;
  property: number;
  cash: number;

  // Cashflow (Investment Currency, real terms).
  annualContribution: number;         // saved into portfolio while working

  // Investment assumptions (real, i.e. above investment-currency inflation).
  equityRealPct: number;
  bondRealPct: number;
  equityPct: number;                  // % equity in portfolio

  // Retirement structure.
  swrPct: number;
  vehicleType: "invested" | "living_annuity" | "guaranteed_annuity" | "blended" | "drawdown";
  drawdownPct: number;                // for living_annuity / drawdown
  annuityRatePct: number;             // for guaranteed_annuity
  blendPct: number;                   // % of pot annuitised in blended

  // Spending (Target Currency, today's money).
  annualSpendingTarget: number;
  spendingMultiplier: number;
  targetInflationPct: number;

  // Currency (Investment → Target).
  fxSpot: number;
  fxDriftPct: number;

  // Other income (annual, real).
  statePensionAnnualInv: number;      // in Investment Currency
  statePensionStartYear: number;
  consultingAnnualInv: number;
  consultingStartYear: number;
  consultingDurationYears: number;
  consultingProbabilityPct: number;
  privatePensionAnnualInv: number;
  privatePensionStartYear: number;

  // Property.
  propertySaleYear: number;           // 2999 = never
  propertyRealGrowthPct: number;
  propertyReinvestPct: number;        // % of net proceeds put into portfolio
  propertySellingCostsPct: number;

  // Targets.
  targetLegacyTgt: number;
  cashReserveTgt: number;

  // Stress layer.
  marketShockYear: number;            // year offset from now (1 = next year); 0 = none
  marketShockPct: number;             // e.g. -30
  bearYears: number;
  bearReturnPct: number;

  // Optional tax hook — phase 1 always returns 0.
  taxRatePct: number;
};

export type ProjectionYear = {
  year: number;
  age: number;
  yearsFromNow: number;
  isRetired: boolean;

  // Wealth (Investment Currency)
  portfolioStart: number;
  portfolioEnd: number;
  property: number;
  cash: number;
  totalWealth: number;

  // Return / stress applied this year
  returnPct: number;

  // Cashflow (Investment Currency)
  contribution: number;
  statePension: number;
  consulting: number;
  privatePension: number;
  portfolioWithdrawalInv: number;
  taxEstimate: number;

  // Lifestyle (Target Currency)
  fxRate: number;
  spendingTgt: number;
  totalIncomeTgt: number;
  sustainableIncomeTgt: number;
  purchasingPowerIndex: number;   // 1.0 = today's lifestyle fully funded
  fireProgress: number;           // 0-100
  confidence: number;             // 0-100
  legacyTgt: number;
  liquidity: number;              // cash / annual spend (years)
  underPressure: boolean;         // withdrawing more than sustainable
};

export type ProjectionSummary = {
  successProbability: number;        // 0-100 deterministic proxy
  yearsPortfolioLasts: number;       // number of retirement years before depletion
  peakWealth: number;
  finalWealth: number;
  finalLegacyTgt: number;
  maxDrawdownPct: number;            // largest peak-to-trough of totalWealth
  yearsUnderPressure: number;
  lowestPurchasingPower: number;
  averageSpendingTgt: number;
  depleted: boolean;
  depletedAtAge: number | null;
  readinessScore: number;
  retirementYear: number;
  retirementAge: number;
};

export type ProjectionOutput = {
  v: 1;
  years: ProjectionYear[];
  summary: ProjectionSummary;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function runProjection(i: ProjectionInputs): ProjectionOutput {
  const years: ProjectionYear[] = [];
  let portfolio = i.portfolio;
  let property = i.property;
  let cash = i.cash;
  let peak = portfolio + property + cash;
  let trough = peak;
  let maxDD = 0;
  let depletedAtAge: number | null = null;
  let yearsPortfolioLasts = 0;
  let yearsUnderPressure = 0;
  let sumSpending = 0;
  let lowestRppi = Infinity;
  const retirementYear = i.startYear + Math.max(0, i.retirementAge - i.currentAge);

  const horizon = Math.max(1, i.planningHorizonAge - i.currentAge);

  // Blended portfolio real return.
  const equityWeight = clamp(i.equityPct / 100, 0, 1);
  const baseRealReturnPct = equityWeight * i.equityRealPct + (1 - equityWeight) * i.bondRealPct;

  for (let y = 0; y <= horizon; y++) {
    const year = i.startYear + y;
    const age = i.currentAge + y;
    const isRetired = age >= i.retirementAge;
    const isSaleYear = year === i.propertySaleYear;

    // ----- Investment return with stress overlay ---------------------------
    let returnPct = baseRealReturnPct;
    if (i.marketShockYear > 0 && y === i.marketShockYear) returnPct = i.marketShockPct;
    else if (i.bearYears > 0 && y > 0 && y <= i.bearYears) returnPct = i.bearReturnPct;

    const portfolioStart = portfolio;
    // Apply return first.
    portfolio = portfolio * (1 + returnPct / 100);
    // Property real growth.
    property = property * (1 + i.propertyRealGrowthPct / 100);

    // ----- Income streams (Investment Currency) ---------------------------
    const stateInv = year >= i.statePensionStartYear ? i.statePensionAnnualInv : 0;
    const consultingActive = year >= i.consultingStartYear && year < i.consultingStartYear + i.consultingDurationYears;
    const consultingInv = consultingActive ? i.consultingAnnualInv * (i.consultingProbabilityPct / 100) : 0;
    const privateInv = year >= i.privatePensionStartYear ? i.privatePensionAnnualInv : 0;

    // Property sale (Investment Currency): net proceeds go partly to portfolio, rest to cash.
    if (isSaleYear && property > 0) {
      const gross = property;
      const net = gross * (1 - i.propertySellingCostsPct / 100);
      const toPortfolio = net * (i.propertyReinvestPct / 100);
      const toCash = net - toPortfolio;
      portfolio += toPortfolio;
      cash += toCash;
      property = 0;
    }

    // ----- Contributions vs withdrawals -----------------------------------
    let contribution = 0;
    let withdrawalInv = 0;
    const fxRate = i.fxSpot * Math.pow(1 + i.fxDriftPct / 100, y);
    const spendingTgt = i.annualSpendingTarget * i.spendingMultiplier * Math.pow(1 + i.targetInflationPct / 100, 0); // real
    const spendingInv = spendingTgt / Math.max(fxRate, 1e-9);
    const otherIncomeInv = stateInv + consultingInv + privateInv;

    if (!isRetired) {
      contribution = i.annualContribution;
      portfolio += contribution;
    } else {
      // Withdraw the shortfall between spending and other income.
      const shortfallInv = Math.max(0, spendingInv - otherIncomeInv);
      // Vehicle-specific limits.
      let allowedInv = shortfallInv;
      if (i.vehicleType === "living_annuity" || i.vehicleType === "drawdown") {
        allowedInv = Math.min(shortfallInv, portfolio * (i.drawdownPct / 100));
      } else if (i.vehicleType === "guaranteed_annuity") {
        // Portfolio annuitised — provides annuityRate * portfolio_at_retirement.
        allowedInv = portfolio * (i.annuityRatePct / 100);
      } else if (i.vehicleType === "blended") {
        const annuitised = portfolio * (i.blendPct / 100);
        const invested = portfolio - annuitised;
        const fromAnnuity = annuitised * (i.annuityRatePct / 100);
        const fromInvested = Math.min(Math.max(0, shortfallInv - fromAnnuity), invested * (i.drawdownPct / 100));
        allowedInv = fromAnnuity + fromInvested;
      }
      withdrawalInv = Math.max(0, Math.min(allowedInv, portfolio));
      portfolio -= withdrawalInv;
      if (portfolio < 0) portfolio = 0;
      if (isRetired) {
        yearsPortfolioLasts += portfolio > 0 ? 1 : 0;
        if (portfolio <= 0 && depletedAtAge == null) depletedAtAge = age;
      }
      if (allowedInv < shortfallInv - 1) yearsUnderPressure++;
    }

    // Tax estimate (phase 1: simple % of taxable income).
    const taxableInv = withdrawalInv + consultingInv + stateInv * 0.5;
    const taxEstimate = taxableInv * (i.taxRatePct / 100);
    portfolio -= Math.min(portfolio, taxEstimate);

    const totalWealth = portfolio + property + cash;
    if (totalWealth > peak) { peak = totalWealth; trough = totalWealth; }
    else if (totalWealth < trough) {
      trough = totalWealth;
      const dd = peak > 0 ? (peak - trough) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }

    // ----- Lifestyle metrics (Target Currency) ----------------------------
    const totalIncomeTgt = (withdrawalInv + otherIncomeInv) * fxRate;
    const sustainableIncomeTgt = portfolio * (i.swrPct / 100) * fxRate;
    const purchasingPowerIndex = spendingTgt > 0 ? sustainableIncomeTgt / spendingTgt : 0;
    if (isRetired && purchasingPowerIndex < lowestRppi) lowestRppi = purchasingPowerIndex;
    const fireTargetInv = spendingInv > 0 ? spendingInv / (i.swrPct / 100) : 0;
    const fireProgress = fireTargetInv > 0 ? clamp((portfolio / fireTargetInv) * 100, 0, 100) : 100;
    const confidence = Math.round(clamp(0.5 * fireProgress + 0.5 * clamp(purchasingPowerIndex * 100, 0, 100), 0, 100));
    const legacyTgt = totalWealth * fxRate;
    const liquidity = spendingTgt > 0 ? (cash * fxRate) / spendingTgt : 0;
    const underPressure = isRetired && portfolio > 0 && sustainableIncomeTgt < spendingTgt;

    if (isRetired) sumSpending += spendingTgt;

    years.push({
      year, age, yearsFromNow: y, isRetired,
      portfolioStart, portfolioEnd: portfolio,
      property, cash, totalWealth, returnPct,
      contribution, statePension: stateInv, consulting: consultingInv, privatePension: privateInv,
      portfolioWithdrawalInv: withdrawalInv, taxEstimate,
      fxRate, spendingTgt, totalIncomeTgt, sustainableIncomeTgt,
      purchasingPowerIndex, fireProgress, confidence, legacyTgt, liquidity, underPressure,
    });
  }

  const retirementYears = years.filter((r) => r.isRetired);
  const averageSpending = retirementYears.length > 0 ? sumSpending / retirementYears.length : 0;
  const finalYear = years[years.length - 1];
  const finalWealth = finalYear ? finalYear.totalWealth : 0;
  const finalLegacyTgt = finalYear ? finalYear.legacyTgt : 0;
  const depleted = depletedAtAge != null;
  const legacyMet = i.targetLegacyTgt > 0 ? finalLegacyTgt >= i.targetLegacyTgt : true;
  const successProbability = Math.round(clamp(
    (depleted ? 20 : 70) +
    (legacyMet ? 15 : 0) +
    (retirementYears.length > 0 && lowestRppi >= 1 ? 15 : 0) -
    Math.min(20, yearsUnderPressure * 2),
    0, 100,
  ));
  const readinessScore = successProbability;

  return {
    v: 1,
    years,
    summary: {
      successProbability,
      yearsPortfolioLasts,
      peakWealth: peak,
      finalWealth,
      finalLegacyTgt,
      maxDrawdownPct: maxDD * 100,
      yearsUnderPressure,
      lowestPurchasingPower: isFinite(lowestRppi) ? lowestRppi : 0,
      averageSpendingTgt: averageSpending,
      depleted,
      depletedAtAge,
      readinessScore,
      retirementYear,
      retirementAge: i.retirementAge,
    },
  };
}

// ---- Sensitivity ---------------------------------------------------------

export type SensitivityDriver = {
  key: keyof ProjectionInputs;
  label: string;
  baseValue: number;
  upValue: number;
  downValue: number;
  upPurchasingPower: number;
  downPurchasingPower: number;
  impactPct: number;    // absolute swing in final purchasing power
};

const DEFAULT_DRIVERS: { key: keyof ProjectionInputs; label: string }[] = [
  { key: "equityRealPct", label: "Equity Real Return" },
  { key: "targetInflationPct", label: "Target Inflation" },
  { key: "fxDriftPct", label: "Currency Drift" },
  { key: "annualSpendingTarget", label: "Annual Spending" },
  { key: "retirementAge", label: "Retirement Age" },
  { key: "swrPct", label: "Safe Withdrawal Rate" },
  { key: "statePensionAnnualInv", label: "State Pension" },
  { key: "consultingAnnualInv", label: "Consulting Income" },
];

export function runSensitivity(inputs: ProjectionInputs, perturbPct = 10): SensitivityDriver[] {
  const base = runProjection(inputs);
  const finalRppi = base.years[base.years.length - 1]?.purchasingPowerIndex ?? 0;
  const drivers: SensitivityDriver[] = [];
  for (const d of DEFAULT_DRIVERS) {
    const baseValue = inputs[d.key] as number;
    if (typeof baseValue !== "number") continue;
    const delta = Math.abs(baseValue) < 1 ? perturbPct / 100 : baseValue * (perturbPct / 100);
    const upInputs = { ...inputs, [d.key]: baseValue + delta };
    const downInputs = { ...inputs, [d.key]: baseValue - delta };
    const up = runProjection(upInputs);
    const dn = runProjection(downInputs);
    const upRppi = up.years[up.years.length - 1]?.purchasingPowerIndex ?? 0;
    const dnRppi = dn.years[dn.years.length - 1]?.purchasingPowerIndex ?? 0;
    const impactPct = Math.abs(upRppi - dnRppi) * 100;
    drivers.push({
      key: d.key, label: d.label,
      baseValue, upValue: baseValue + delta, downValue: baseValue - delta,
      upPurchasingPower: upRppi, downPurchasingPower: dnRppi, impactPct,
    });
  }
  return drivers.sort((a, b) => b.impactPct - a.impactPct);
}

export function baseInputs(): ProjectionInputs {
  const nowYear = new Date().getFullYear();
  return {
    currentAge: 55, retirementAge: 60, planningHorizonAge: 95, startYear: nowYear,
    portfolio: 0, property: 0, cash: 0, annualContribution: 0,
    equityRealPct: 4, bondRealPct: 1, equityPct: 70,
    swrPct: 3.5, vehicleType: "invested",
    drawdownPct: 4.5, annuityRatePct: 6.5, blendPct: 50,
    annualSpendingTarget: 0, spendingMultiplier: 1, targetInflationPct: 5.5,
    fxSpot: 1, fxDriftPct: 0,
    statePensionAnnualInv: 0, statePensionStartYear: nowYear + 10,
    consultingAnnualInv: 0, consultingStartYear: nowYear, consultingDurationYears: 0, consultingProbabilityPct: 100,
    privatePensionAnnualInv: 0, privatePensionStartYear: nowYear + 10,
    propertySaleYear: 2999, propertyRealGrowthPct: 1, propertyReinvestPct: 100, propertySellingCostsPct: 3,
    targetLegacyTgt: 0, cashReserveTgt: 0,
    marketShockYear: 0, marketShockPct: 0, bearYears: 0, bearReturnPct: 0,
    taxRatePct: 0,
  };
}