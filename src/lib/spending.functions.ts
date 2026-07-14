import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// 13 canonical spending categories, grouped into Core (essentials) and
// Lifestyle (discretionary). Each rolls up into total annual spending, which
// drives the dynamic FIRE target.

type Seed = {
  key: string;
  label: string;
  rollup: "core" | "lifestyle";
  essential: boolean;
  amount: number;
  inflation_key: string | null;
  sort_order: number;
};

export const SPENDING_SEEDS: Seed[] = [
  { key: "housing",       label: "Housing",           rollup: "core",      essential: true,  amount: 12000, inflation_key: "inflation.uk",         sort_order: 10 },
  { key: "utilities",     label: "Utilities",         rollup: "core",      essential: true,  amount: 3000,  inflation_key: "inflation.uk",         sort_order: 20 },
  { key: "food",          label: "Food",              rollup: "core",      essential: true,  amount: 6000,  inflation_key: "inflation.uk",         sort_order: 30 },
  { key: "medical",       label: "Medical",           rollup: "core",      essential: true,  amount: 3000,  inflation_key: "inflation.healthcare", sort_order: 40 },
  { key: "insurance",     label: "Insurance",         rollup: "core",      essential: true,  amount: 2000,  inflation_key: "inflation.uk",         sort_order: 50 },
  { key: "vehicles",      label: "Vehicles",          rollup: "core",      essential: true,  amount: 3000,  inflation_key: "inflation.uk",         sort_order: 60 },
  { key: "household",     label: "Household",         rollup: "core",      essential: true,  amount: 3000,  inflation_key: "inflation.uk",         sort_order: 70 },
  { key: "contingency",   label: "Contingency",       rollup: "core",      essential: true,  amount: 3000,  inflation_key: "inflation.uk",         sort_order: 80 },
  { key: "travel",        label: "Travel",            rollup: "lifestyle", essential: false, amount: 8000,  inflation_key: "inflation.uk",         sort_order: 110 },
  { key: "technology",    label: "Technology",        rollup: "lifestyle", essential: false, amount: 1500,  inflation_key: "inflation.uk",         sort_order: 120 },
  { key: "entertainment", label: "Entertainment",     rollup: "lifestyle", essential: false, amount: 2500,  inflation_key: "inflation.uk",         sort_order: 130 },
  { key: "family",        label: "Helping Family",    rollup: "lifestyle", essential: false, amount: 3000,  inflation_key: "inflation.uk",         sort_order: 140 },
  { key: "charity",       label: "Charitable Giving", rollup: "lifestyle", essential: false, amount: 1500,  inflation_key: "inflation.uk",         sort_order: 150 },
];

export const listSpending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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