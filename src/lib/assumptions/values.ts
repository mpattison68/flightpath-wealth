// Helper to read a numeric value from the assumptions list by key.

export type AssumptionRowLike = {
  key: string;
  value_numeric: number | null;
};

export function assumptionMap(rows: AssumptionRowLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.value_numeric != null) m.set(r.key, Number(r.value_numeric));
  }
  return m;
}

export function get(map: Map<string, number>, key: string, fallback = 0): number {
  return map.has(key) ? (map.get(key) as number) : fallback;
}