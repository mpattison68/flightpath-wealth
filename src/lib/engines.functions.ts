import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Canonical seed of Financial Engines. Retirement income is funded by
// several independent engines working together. Each user gets a row per
// engine on first read — status controls how the UI treats them.

export type EngineKind =
  | "portfolio"
  | "property"
  | "state_pension"
  | "private_pension"
  | "consulting"
  | "rental"
  | "annuity";

type Seed = {
  kind: EngineKind;
  label: string;
  status: "active" | "planned" | "future";
  sort_order: number;
  description: string;
};

export const ENGINE_SEEDS: Seed[] = [
  { kind: "portfolio",       label: "Investment Portfolio", status: "active",  sort_order: 10, description: "Drawdown from liquid investments at the safe withdrawal rate." },
  { kind: "property",        label: "Property",             status: "active",  sort_order: 20, description: "Capital released on planned property sale." },
  { kind: "state_pension",   label: "State Pension",        status: "active",  sort_order: 30, description: "Government pension from expected start date." },
  { kind: "private_pension", label: "Private Pension",      status: "planned", sort_order: 40, description: "Occupational or personal pension income." },
  { kind: "consulting",      label: "Consulting Income",    status: "planned", sort_order: 50, description: "Time-limited earned income after main career." },
  { kind: "rental",          label: "Rental Income",        status: "future",  sort_order: 60, description: "Net rental from investment property." },
  { kind: "annuity",         label: "Future Annuities",     status: "future",  sort_order: 70, description: "Guaranteed lifetime income products." },
];

export const listEngines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing, error } = await context.supabase
      .from("financial_engines")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const have = new Set((existing ?? []).map((r) => r.kind));
    const missing = ENGINE_SEEDS.filter((s) => !have.has(s.kind));
    if (missing.length > 0) {
      await context.supabase.from("financial_engines").insert(
        missing.map((s) => ({
          user_id: context.userId,
          kind: s.kind,
          label: s.label,
          status: s.status,
          sort_order: s.sort_order,
          metadata: { description: s.description },
        })),
      );
      const { data: refreshed } = await context.supabase
        .from("financial_engines")
        .select("*")
        .order("sort_order", { ascending: true });
      return refreshed ?? [];
    }
    return existing ?? [];
  });