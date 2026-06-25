export function formatCurrency(amount: number, currency = "GBP", locale = "en-GB") {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
}