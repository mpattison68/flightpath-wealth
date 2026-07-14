import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AssumptionCategory =
  | "Inflation"
  | "Investment"
  | "Currency"
  | "Retirement"
  | "Spending"
  | "Property"
  | "State Pension"
  | "Consulting";

export type AssumptionSeed = {
  key: string;
  category: AssumptionCategory;
  label: string;
  unit: string | null;
  value_numeric: number | null;
  description: string;
};

// Canonical catalogue of all assumption keys the app knows about. Rows are
// lazily created for the current user on first read of the Centre. Values
// here are used only if the user has no row yet for that key.
export const ASSUMPTION_CATALOGUE: AssumptionSeed[] = [
  // Inflation
  { key: "inflation.uk",           category: "Inflation",     label: "UK Inflation",              unit: "%",   value_numeric: 2.5,  description: "Expected long-run annual UK CPI." },
  { key: "inflation.za",           category: "Inflation",     label: "South African Inflation",   unit: "%",   value_numeric: 5.0,  description: "Expected long-run annual SA CPI." },
  { key: "inflation.healthcare",   category: "Inflation",     label: "Healthcare Inflation",      unit: "%",   value_numeric: 5.0,  description: "Expected healthcare cost inflation." },
  { key: "inflation.property",     category: "Inflation",     label: "Property Inflation",        unit: "%",   value_numeric: 3.0,  description: "Expected long-run property price growth." },
  // Investment
  { key: "growth.equity_real",     category: "Investment",    label: "Equity Real Return",        unit: "%",   value_numeric: 4.0,  description: "Expected annual equity return above inflation." },
  { key: "growth.bond_real",       category: "Investment",    label: "Bond Real Return",          unit: "%",   value_numeric: 1.0,  description: "Expected annual bond return above inflation." },
  { key: "growth.cash_real",       category: "Investment",    label: "Cash Real Return",          unit: "%",   value_numeric: -0.5, description: "Expected annual cash return above inflation." },
  { key: "growth.property_real",   category: "Investment",    label: "Property Real Return",      unit: "%",   value_numeric: 1.0,  description: "Expected property capital growth above inflation." },
  // Currency
  { key: "fx.gbpzar_trend",        category: "Currency",      label: "Long-Term GBP/ZAR Trend",   unit: "%/yr",value_numeric: 4.0,  description: "Expected long-run annual GBP appreciation vs ZAR." },
  { key: "fx.usdgbp_trend",        category: "Currency",      label: "Long-Term USD/GBP Trend",   unit: "%/yr",value_numeric: 0.0,  description: "Expected long-run annual USD/GBP drift." },
  // Retirement
  { key: "retirement.target_age",  category: "Retirement",    label: "Target Retirement Age",     unit: "age", value_numeric: 60,   description: "Age you plan to retire." },
  { key: "retirement.horizon",     category: "Retirement",    label: "Planning Horizon",          unit: "yrs", value_numeric: 40,   description: "Years to model in projections." },
  { key: "retirement.life_expectancy", category: "Retirement",label: "Life Expectancy",           unit: "age", value_numeric: 92,   description: "Age the portfolio must last until." },
  { key: "retirement.partner_life_expectancy", category: "Retirement", label: "Partner Life Expectancy", unit: "age", value_numeric: 92, description: "Partner's expected age." },
  { key: "retirement.legacy",      category: "Retirement",    label: "Desired Legacy",            unit: "GBP", value_numeric: 0,    description: "Amount you'd like to leave behind." },
  { key: "retirement.cash_reserve",category: "Retirement",    label: "Target Cash Reserve",       unit: "GBP", value_numeric: 50000,description: "Cash buffer to keep at all times." },
  { key: "retirement.emergency_reserve", category: "Retirement", label: "Emergency Reserve",      unit: "GBP", value_numeric: 20000,description: "Emergency fund target." },
  { key: "withdrawal.swr",         category: "Retirement",    label: "Safe Withdrawal Rate",      unit: "%",   value_numeric: 3.5,  description: "Assumed sustainable withdrawal rate." },
  { key: "fire.target_total",      category: "Retirement",    label: "FIRE Target (Total)",       unit: "GBP", value_numeric: 1500000, description: "Total net worth for FI." },
  { key: "fire.target_liquid",     category: "Retirement",    label: "FIRE Target (Liquid)",      unit: "GBP", value_numeric: 900000,  description: "Liquid drawable assets for FI." },
  // Spending
  { key: "spending.core",          category: "Spending",      label: "Core Spending",             unit: "GBP/yr", value_numeric: 30000, description: "Essential annual spending." },
  { key: "spending.lifestyle",     category: "Spending",      label: "Lifestyle Spending",        unit: "GBP/yr", value_numeric: 15000, description: "Discretionary lifestyle spend." },
  { key: "spending.travel",        category: "Spending",      label: "Travel",                    unit: "GBP/yr", value_numeric: 8000,  description: "Annual travel budget." },
  { key: "spending.healthcare",    category: "Spending",      label: "Healthcare",                unit: "GBP/yr", value_numeric: 3000,  description: "Annual healthcare spend." },
  { key: "spending.vehicle_replacement", category: "Spending",label: "Vehicle Replacement",       unit: "GBP/yr", value_numeric: 3000,  description: "Amortised vehicle costs." },
  { key: "spending.home_maintenance", category: "Spending",   label: "Home Maintenance",          unit: "GBP/yr", value_numeric: 3000,  description: "Annual home maintenance." },
  // Property
  { key: "property.sale_year",     category: "Property",      label: "Expected Sale Year",        unit: "year",value_numeric: 2035, description: "Year you expect to sell the property." },
  { key: "property.sale_price",    category: "Property",      label: "Expected Sale Price",       unit: "GBP", value_numeric: 0,    description: "Expected gross sale price." },
  { key: "property.selling_costs", category: "Property",      label: "Estimated Selling Costs",   unit: "%",   value_numeric: 3.0,  description: "Fees, agent, legal as % of sale price." },
  { key: "property.tax",           category: "Property",      label: "Estimated Tax on Sale",     unit: "GBP", value_numeric: 0,    description: "Estimated CGT / other tax on sale." },
  { key: "property.mortgage_balance", category: "Property",   label: "Mortgage Balance",          unit: "GBP", value_numeric: 0,    description: "Outstanding mortgage balance." },
  // State Pension
  { key: "state_pension.amount",   category: "State Pension", label: "Forecast Amount",           unit: "GBP/yr", value_numeric: 11500, description: "Forecast annual state pension." },
  { key: "state_pension.start_date", category: "State Pension", label: "Expected Start Date",     unit: "year",value_numeric: 2045, description: "Year state pension begins." },
  { key: "state_pension.indexation", category: "State Pension", label: "Indexation",              unit: "%",   value_numeric: 2.5,  description: "Assumed annual uplift." },
  { key: "state_pension.confidence", category: "State Pension", label: "Confidence",              unit: "%",   value_numeric: 90,   description: "Probability the forecast is delivered." },
  // Consulting
  { key: "consulting.annual_income", category: "Consulting",  label: "Expected Annual Income",    unit: "GBP/yr", value_numeric: 0,    description: "Expected consulting income." },
  { key: "consulting.start",       category: "Consulting",    label: "Expected Start",            unit: "year",value_numeric: 2026, description: "Year consulting starts." },
  { key: "consulting.duration",    category: "Consulting",    label: "Expected Duration",         unit: "yrs", value_numeric: 5,    description: "Years of consulting income." },
  { key: "consulting.probability", category: "Consulting",    label: "Probability",               unit: "%",   value_numeric: 60,   description: "Probability this income materialises." },
];

export const listAssumptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("planning_assumptions")
      .select("*")
      .order("category", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    const existing = new Map((data ?? []).map((r) => [r.key, r]));
    const merged = ASSUMPTION_CATALOGUE.map((seed) => {
      const row = existing.get(seed.key);
      if (row) return { ...seed, ...row, isSeeded: false as const };
      return {
        id: null as string | null,
        user_id: context.userId,
        key: seed.key,
        category: seed.category,
        label: seed.label,
        unit: seed.unit,
        value_numeric: seed.value_numeric,
        value_json: null,
        confidence: "medium" as const,
        source: null as string | null,
        description: seed.description,
        ai_commentary: null as string | null,
        last_reviewed_at: null as string | null,
        review_due_at: null as string | null,
        created_at: null as string | null,
        updated_at: null as string | null,
        isSeeded: true as const,
      };
    });
    return merged;
  });

const UpsertInput = z.object({
  key: z.string().min(1),
  category: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().nullable().optional(),
  value_numeric: z.number().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const upsertAssumption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: prior } = await context.supabase
      .from("planning_assumptions")
      .select("id, value_numeric")
      .eq("key", data.key)
      .maybeSingle();

    const row = {
      user_id: context.userId,
      key: data.key,
      category: data.category,
      label: data.label,
      unit: data.unit ?? null,
      value_numeric: data.value_numeric ?? null,
      confidence: data.confidence,
      source: data.source ?? null,
      description: data.description ?? null,
      last_reviewed_at: new Date().toISOString(),
    };
    const { data: saved, error } = await context.supabase
      .from("planning_assumptions")
      .upsert(row, { onConflict: "user_id,key" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (prior?.value_numeric !== saved.value_numeric) {
      await context.supabase.from("planning_assumption_history").insert({
        user_id: context.userId,
        assumption_id: saved.id,
        key: saved.key,
        old_value: prior ? { value_numeric: prior.value_numeric } : null,
        new_value: { value_numeric: saved.value_numeric },
        note: data.note ?? null,
      });
    }
    return saved;
  });

export const markAssumptionReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("planning_assumptions")
      .update({ last_reviewed_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAssumptionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("planning_assumption_history")
      .select("*")
      .eq("key", data.key)
      .order("changed_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });