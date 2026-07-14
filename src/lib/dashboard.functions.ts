import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [holdings, plans, settings, snapshots, income, properties, profile] = await Promise.all([
      context.supabase.from("holdings").select("*"),
      context.supabase.from("retirement_plans").select("*").eq("is_active", true).limit(1).maybeSingle(),
      context.supabase.from("user_settings").select("*").maybeSingle(),
      context.supabase.from("valuation_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(12),
      context.supabase.from("income_sources").select("*").eq("enabled", true),
      context.supabase.from("property_assets").select("*"),
      context.supabase.from("profiles").select("*").maybeSingle(),
    ]);
    return {
      holdings: holdings.data ?? [],
      plan: plans.data ?? null,
      settings: settings.data ?? null,
      snapshots: snapshots.data ?? [],
      incomeSources: income.data ?? [],
      properties: properties.data ?? [],
      profile: profile.data ?? null,
    };
  });