import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, settings] = await Promise.all([
      context.supabase.from("profiles").select("*").maybeSingle(),
      context.supabase.from("user_settings").select("*").maybeSingle(),
    ]);
    return { profile: profile.data, settings: settings.data };
  });

const AssumptionsInput = z.object({
  inflation_pct: z.number().min(0).max(20),
  real_growth_pct: z.number().min(-5).max(20),
  swr_pct: z.number().min(0).max(15),
  life_expectancy: z.number().int().min(60).max(110),
  fire_target: z.number().nonnegative(),
  liquid_fire_target: z.number().nonnegative(),
});

export const updateAssumptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AssumptionsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_settings")
      .upsert({ user_id: context.userId, assumptions: data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ProfileInput = z.object({
  display_name: z.string().nullable().optional(),
  base_currency: z.string().min(3).max(3),
  alt_currency: z.string().min(3).max(3).nullable().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ user_id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UserSettingsInput = z.object({
  primary_spending_currency: z.string().min(3).max(3).nullable().optional(),
});

export const updateUserSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UserSettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_settings")
      .upsert({ user_id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });