// Currency model for Wealth Flightpath.
//
// - Investment Currency: where wealth is accumulated (portfolio, holdings,
//   allocation, historical returns). Backed by profiles.base_currency.
// - Target Currency: where retirement will be funded (spending, FIRE target,
//   retirement income, purchasing power). Backed by profiles.alt_currency.
//
// These are conceptually different: portfolio value belongs in Investment
// Currency; retirement planning belongs in Target Currency. Never mix them
// within the same chart, KPI or calculation.

export type Profile = {
  base_currency?: string | null;
  alt_currency?: string | null;
} | null | undefined;

export function investmentCurrency(profile: Profile): string {
  return (profile?.base_currency || "GBP").toUpperCase();
}

export function targetCurrency(profile: Profile): string {
  // If no target is configured, fall back to the investment currency so
  // retirement metrics still render (no conversion, but consistent labels).
  return (profile?.alt_currency || profile?.base_currency || "GBP").toUpperCase();
}

export function needsFx(profile: Profile): boolean {
  return investmentCurrency(profile) !== targetCurrency(profile);
}