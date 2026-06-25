import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getActivePlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("retirement_plans")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const PlanInput = z.object({
  name: z.string().default("Active Plan"),
  date_of_birth: z.string().nullable().optional(),
  target_retirement_date: z.string().nullable().optional(),
  desired_annual_income: z.number().nullable().optional(),
  current_annual_spend: z.number().nullable().optional(),
});

export const upsertActivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("retirement_plans")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    const row = { ...data, user_id: context.userId, is_active: true };
    const query = existing
      ? context.supabase.from("retirement_plans").update(row).eq("id", existing.id).select().single()
      : context.supabase.from("retirement_plans").insert(row).select().single();
    const { data: result, error } = await query;
    if (error) throw new Error(error.message);
    return result;
  });