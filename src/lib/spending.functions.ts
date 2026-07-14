import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Canonical Retirement Lifestyle categories, grouped into:
//   - core      essentials the plan must always cover
//   - lifestyle discretionary spending that defines the desired retirement
//   - reserve   long-term replacement reserves (vehicles, major household)
//
// Each row rolls up into total annual Target-Currency lifestyle spending,
// which drives the dynamic FIRE target and every retirement calculation.

type Seed = {
  key: string;
  label: string;
  rollup: "core" | "lifestyle" | "reserve";
  essential: boolean;
  amount: number;
  inflation_key: string | null;
  sort_order: number;
};

// Amounts are seeded in the user's Target Currency (where retirement is
// funded). Defaults reflect the ZAR baseline used during onboarding.
// Core R780,000 + Lifestyle R390,000 + Reserve R30,000 = R1,200,000 / year.
export const SPENDING_SEEDS: Seed[] = [
  // Core (essentials) — R780,000
  { key: "housing",       label: "Housing & Utilities",       rollup: "core",      essential: true,  amount: 180_000, inflation_key: "inflation.target",     sort_order: 10 },
  { key: "food",          label: "Food & Household",          rollup: "core",      essential: true,  amount: 180_000, inflation_key: "inflation.target",     sort_order: 20 },
  { key: "medical",       label: "Medical",                   rollup: "core",      essential: true,  amount: 180_000, inflation_key: "inflation.healthcare", sort_order: 30 },
  { key: "insurance",     label: "Insurance",                 rollup: "core",      essential: true,  amount: 60_000,  inflation_key: "inflation.target",     sort_order: 40 },
  { key: "transport",     label: "Transport & Vehicles",      rollup: "core",      essential: true,  amount: 120_000, inflation_key: "inflation.target",     sort_order: 50 },
  { key: "contingency",   label: "Contingency",               rollup: "core",      essential: true,  amount: 60_000,  inflation_key: "inflation.target",     sort_order: 60 },
  // Lifestyle (discretionary) — R390,000
  { key: "travel",        label: "Travel",                    rollup: "lifestyle", essential: false, amount: 180_000, inflation_key: "inflation.target",     sort_order: 110 },
  { key: "entertainment", label: "Entertainment & Dining",    rollup: "lifestyle", essential: false, amount: 90_000,  inflation_key: "inflation.target",     sort_order: 120 },
  { key: "technology",    label: "Technology",                rollup: "lifestyle", essential: false, amount: 30_000,  inflation_key: "inflation.target",     sort_order: 130 },
  { key: "family",        label: "Helping Family",            rollup: "lifestyle", essential: false, amount: 60_000,  inflation_key: "inflation.target",     sort_order: 140 },
  { key: "charity",       label: "Charitable Giving",         rollup: "lifestyle", essential: false, amount: 30_000,  inflation_key: "inflation.target",     sort_order: 150 },
  // Long-term replacement reserve — R30,000
  { key: "vehicle_replacement", label: "Vehicle Replacement",       rollup: "reserve", essential: false, amount: 15_000, inflation_key: "inflation.target", sort_order: 210 },
  { key: "major_household",     label: "Major Household Purchases", rollup: "reserve", essential: false, amount: 15_000, inflation_key: "inflation.target", sort_order: 220 },
];

export const listSpending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Read the Target Currency (where retirement is funded). Every seeded
    // category is stored in this currency so totals stay currency-consistent.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("base_currency, alt_currency")
      .maybeSingle();
    const targetCcy = (profile?.alt_currency || profile?.base_currency || "GBP").toUpperCase();

    const { data: rows, error } = await context.supabase
      .from("spending_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const have = new Set((rows ?? []).map((r) => r.key));
    const missing = SPENDING_SEEDS.filter((s) => !have.has(s.key));
    if (missing.length > 0) {
      await context.supabase.from("spending_categories").insert(
        missing.map((s) => ({
          user_id: context.userId,
          key: s.key,
          label: s.label,
          rollup: s.rollup,
          essential: s.essential,
          annual_amount: s.amount,
          currency: targetCcy,
          inflation_key: s.inflation_key,
          sort_order: s.sort_order,
        })),
      );
      const { data: refreshed } = await context.supabase
        .from("spending_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      return refreshed ?? [];
    }
    return rows ?? [];
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  annual_amount: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
});

export const updateSpending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("spending_categories")
      .update({ annual_amount: data.annual_amount, notes: data.notes ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });