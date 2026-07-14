import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { runProjection, runSensitivity, type ProjectionInputs, type ProjectionOutput, type SensitivityDriver } from "@/lib/finance/projection";
import { resolveProjectionInputs } from "@/lib/scenarios/resolver";
import { findPreset, STRESS_PRESETS } from "@/lib/scenarios/stress-presets";
import { findSubtype } from "@/lib/scenarios/catalog";

// ---------- Shared helpers ------------------------------------------------

async function loadUserContext(supabase: import("@supabase/supabase-js").SupabaseClient) {
  const [holdings, plans, settings, properties, profile, assumptions, spending] = await Promise.all([
    supabase.from("holdings").select("value, currency"),
    supabase.from("retirement_plans").select("*").eq("is_active", true).maybeSingle(),
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("property_assets").select("*"),
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("planning_assumptions").select("key, value_numeric"),
    supabase.from("spending_categories").select("annual_amount"),
  ]);
  const portfolio = (holdings.data ?? []).reduce((s, h) => s + Number(h.value || 0), 0);
  const property = (properties.data ?? []).reduce((s, p) => s + Number(p.current_value || 0), 0);
  const cash = 0;
  const spendingTarget = (spending.data ?? []).reduce((s, r) => s + Number(r.annual_amount || 0), 0);
  const dob = plans.data?.date_of_birth ? new Date(plans.data.date_of_birth) : null;
  const currentAge = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : 55;
  return {
    profile: profile.data,
    plan: plans.data,
    settings: settings.data,
    assumptions: assumptions.data ?? [],
    ctx: {
      currentAge,
      startYear: new Date().getFullYear(),
      portfolio, property, cash,
      spendingTarget,
      fxSpot: 1, // resolved per-call — retirement page already fetches FX; scenarios use plan-time spot from settings if present
    },
  };
}

// ---------- CRUD ---------------------------------------------------------

export const listScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scenarios")
      .select("*")
      .order("is_baseline", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getScenario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [scenario, overrides, stress] = await Promise.all([
      context.supabase.from("scenarios").select("*").eq("id", data.id).single(),
      context.supabase.from("scenario_overrides").select("*").eq("scenario_id", data.id),
      context.supabase.from("scenario_stress_tests").select("*").eq("scenario_id", data.id),
    ]);
    if (scenario.error) throw new Error(scenario.error.message);
    return {
      scenario: scenario.data,
      overrides: overrides.data ?? [],
      stressTests: stress.data ?? [],
    };
  });

const CreateInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  scenario_type: z.string().default("retirement_timing"),
  subtype: z.string().optional().nullable(),
  probability: z.number().min(0).max(100).optional().nullable(),
});

export const createScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scenarios")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        scenario_type: data.scenario_type,
        subtype: data.subtype ?? null,
        probability: data.probability ?? null,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Seed overrides from the subtype template.
    const subtype = findSubtype(data.subtype ?? undefined);
    if (subtype && Object.keys(subtype.overrides).length > 0) {
      const rows = Object.entries(subtype.overrides)
        .filter(([, v]) => typeof v === "number")
        .map(([key, value]) => ({
          user_id: context.userId,
          scenario_id: row.id,
          assumption_key: key,
          value_numeric: value as number,
        }));
      if (rows.length > 0) await context.supabase.from("scenario_overrides").insert(rows);
    }
    return row;
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  probability: z.number().min(0).max(100).nullable().optional(),
  scenario_type: z.string().optional(),
  subtype: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("scenarios")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scenarios").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [src, ov] = await Promise.all([
      context.supabase.from("scenarios").select("*").eq("id", data.id).single(),
      context.supabase.from("scenario_overrides").select("assumption_key, value_numeric, value_json, note").eq("scenario_id", data.id),
    ]);
    if (src.error) throw new Error(src.error.message);
    const { data: copy, error } = await context.supabase
      .from("scenarios")
      .insert({
        user_id: context.userId,
        name: `${src.data.name} (copy)`,
        description: src.data.description,
        scenario_type: src.data.scenario_type,
        subtype: src.data.subtype,
        probability: src.data.probability,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if ((ov.data ?? []).length > 0) {
      await context.supabase.from("scenario_overrides").insert(
        (ov.data ?? []).map((r) => ({
          user_id: context.userId,
          scenario_id: copy.id,
          assumption_key: r.assumption_key,
          value_numeric: r.value_numeric,
          value_json: r.value_json,
          note: r.note,
        })),
      );
    }
    return copy;
  });

export const setBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("scenarios").update({ is_baseline: false }).eq("user_id", context.userId);
    const { error } = await context.supabase.from("scenarios").update({ is_baseline: true, status: "active" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Overrides -----------------------------------------------------

const UpsertOverride = z.object({
  scenario_id: z.string().uuid(),
  assumption_key: z.string().min(1),
  value_numeric: z.number().nullable(),
  note: z.string().nullable().optional(),
});

export const upsertOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertOverride.parse(i))
  .handler(async ({ data, context }) => {
    if (data.value_numeric == null) {
      await context.supabase
        .from("scenario_overrides")
        .delete()
        .eq("scenario_id", data.scenario_id)
        .eq("assumption_key", data.assumption_key);
      return { ok: true };
    }
    const { data: existing } = await context.supabase
      .from("scenario_overrides")
      .select("id")
      .eq("scenario_id", data.scenario_id)
      .eq("assumption_key", data.assumption_key)
      .maybeSingle();
    const row = {
      user_id: context.userId,
      scenario_id: data.scenario_id,
      assumption_key: data.assumption_key,
      value_numeric: data.value_numeric,
      note: data.note ?? null,
    };
    const q = existing
      ? context.supabase.from("scenario_overrides").update(row).eq("id", existing.id).select().single()
      : context.supabase.from("scenario_overrides").insert(row).select().single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

// ---------- Projection ----------------------------------------------------

function runFor(
  ctx: Awaited<ReturnType<typeof loadUserContext>>,
  overrides: { assumption_key: string; value_numeric: number | null }[],
  extra?: Record<string, number>,
  vehicleType?: ProjectionInputs["vehicleType"],
): ProjectionOutput {
  const inputs = resolveProjectionInputs({
    ctx: ctx.ctx,
    assumptions: ctx.assumptions,
    overrides,
    extra,
    vehicleType,
  });
  return runProjection(inputs);
}

function vehicleFromOverrides(overrides: { assumption_key: string; value_json: unknown }[]): ProjectionInputs["vehicleType"] {
  const row = overrides.find((o) => o.assumption_key === "vehicle.type");
  const raw = row?.value_json;
  if (typeof raw === "string" && ["invested", "living_annuity", "guaranteed_annuity", "blended", "drawdown"].includes(raw)) {
    return raw as ProjectionInputs["vehicleType"];
  }
  return "invested";
}

export const runScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [uctx, ov, scen] = await Promise.all([
      loadUserContext(context.supabase),
      context.supabase.from("scenario_overrides").select("*").eq("scenario_id", data.id),
      context.supabase.from("scenarios").select("*").eq("id", data.id).single(),
    ]);
    if (ov.error) throw new Error(ov.error.message);
    if (scen.error) throw new Error(scen.error.message);
    const result = runFor(uctx, ov.data ?? [], undefined, vehicleFromOverrides(ov.data ?? []));
    await context.supabase
      .from("scenarios")
      .update({
        projection: result as unknown as Record<string, unknown>,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return result;
  });

export const compareScenarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(6) }).parse(i))
  .handler(async ({ data, context }) => {
    const uctx = await loadUserContext(context.supabase);
    const results = await Promise.all(
      data.ids.map(async (id) => {
        const [scen, ov] = await Promise.all([
          context.supabase.from("scenarios").select("*").eq("id", id).single(),
          context.supabase.from("scenario_overrides").select("*").eq("scenario_id", id),
        ]);
        if (scen.error || !scen.data) return null;
        const projection = runFor(uctx, ov.data ?? [], undefined, vehicleFromOverrides(ov.data ?? []));
        return { scenario: scen.data, projection };
      }),
    );
    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  });

// ---------- Stress tests --------------------------------------------------

export const runStressTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    scenario_id: z.string().uuid(),
    preset_key: z.string().min(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const preset = findPreset(data.preset_key);
    if (!preset) throw new Error(`Unknown stress preset: ${data.preset_key}`);
    const [uctx, ov] = await Promise.all([
      loadUserContext(context.supabase),
      context.supabase.from("scenario_overrides").select("*").eq("scenario_id", data.scenario_id),
    ]);
    const result = runFor(uctx, ov.data ?? [], preset.overrides, vehicleFromOverrides(ov.data ?? []));

    // Upsert on (scenario_id, preset_key).
    const { data: existing } = await context.supabase
      .from("scenario_stress_tests")
      .select("id")
      .eq("scenario_id", data.scenario_id)
      .eq("preset_key", data.preset_key)
      .maybeSingle();
    const row = {
      user_id: context.userId,
      scenario_id: data.scenario_id,
      preset_key: data.preset_key,
      label: preset.label,
      overrides: preset.overrides as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
    };
    const q = existing
      ? context.supabase.from("scenario_stress_tests").update(row).eq("id", existing.id).select().single()
      : context.supabase.from("scenario_stress_tests").insert(row).select().single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const listStressPresets = createServerFn({ method: "GET" }).handler(async () => STRESS_PRESETS);

// ---------- Sensitivity ---------------------------------------------------

export const getSensitivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ scenario_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<SensitivityDriver[]> => {
    const [uctx, ov] = await Promise.all([
      loadUserContext(context.supabase),
      context.supabase.from("scenario_overrides").select("*").eq("scenario_id", data.scenario_id),
    ]);
    const inputs = resolveProjectionInputs({
      ctx: uctx.ctx,
      assumptions: uctx.assumptions,
      overrides: ov.data ?? [],
      vehicleType: vehicleFromOverrides(ov.data ?? []),
    });
    return runSensitivity(inputs);
  });

// ---------- AI Strategy Review -------------------------------------------

export const generateAiReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ scenario_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const [uctx, ov, scen] = await Promise.all([
      loadUserContext(context.supabase),
      context.supabase.from("scenario_overrides").select("*").eq("scenario_id", data.scenario_id),
      context.supabase.from("scenarios").select("*").eq("id", data.scenario_id).single(),
    ]);
    if (scen.error) throw new Error(scen.error.message);
    const projection = runFor(uctx, ov.data ?? [], undefined, vehicleFromOverrides(ov.data ?? []));
    const invCcy = (uctx.profile?.base_currency || "GBP").toUpperCase();
    const tgtCcy = (uctx.profile?.alt_currency || invCcy).toUpperCase();

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.5-flash");

    const overridesText = (ov.data ?? [])
      .map((o) => `- ${o.assumption_key} = ${o.value_numeric}`)
      .join("\n") || "(none — inherits all baseline assumptions)";
    const s = projection.summary;
    const lastYear = projection.years[projection.years.length - 1];
    const firstRetire = projection.years.find((y) => y.isRetired);

    const system = `You are a Retirement Strategy Coach for Wealth Flightpath. The user separates two worlds:
- Wealth World: portfolio and property in Investment Currency (${invCcy}).
- Retirement Lifestyle: spending and outcomes in Target Currency (${tgtCcy}).
Always speak in terms of purchasing power in ${tgtCcy}, not portfolio value in ${invCcy}.
You explain trade-offs; you do not give regulated financial advice.
Return concise, structured markdown with these headings: Strengths, Weaknesses, Key Risks, Sensitivity, Tax & Currency, Suggested Improvements, Trade-off Summary.`;

    const user = `Scenario: ${scen.data.name}
Type: ${scen.data.scenario_type}${scen.data.subtype ? ` / ${scen.data.subtype}` : ""}
Description: ${scen.data.description ?? "—"}

Overrides on top of baseline:
${overridesText}

Projection summary:
- Retirement age: ${s.retirementAge} (year ${s.retirementYear})
- Success probability (deterministic proxy): ${s.successProbability}/100
- Years portfolio lasts in retirement: ${s.yearsPortfolioLasts}
- Depleted: ${s.depleted ? `yes, at age ${s.depletedAtAge}` : "no"}
- Peak wealth (${invCcy}): ${Math.round(s.peakWealth)}
- Final wealth (${invCcy}): ${Math.round(s.finalWealth)}
- Final legacy (${tgtCcy}): ${Math.round(s.finalLegacyTgt)}
- Max drawdown: ${s.maxDrawdownPct.toFixed(1)}%
- Years under pressure: ${s.yearsUnderPressure}
- Lowest purchasing power (RPPI): ${s.lowestPurchasingPower.toFixed(2)}×
- Average retirement spending (${tgtCcy}): ${Math.round(s.averageSpendingTgt)}

First retirement year: ${firstRetire ? `${firstRetire.year} — spending ${Math.round(firstRetire.spendingTgt)} ${tgtCcy}, income ${Math.round(firstRetire.totalIncomeTgt)} ${tgtCcy}` : "—"}
Final year (${lastYear?.year}): purchasing power ${lastYear?.purchasingPowerIndex.toFixed(2)}×

Explain why this strategy produces this outcome, which assumptions drive it most, and what would improve it.`;

    const { text } = await generateText({ model, system, prompt: user });

    await context.supabase
      .from("scenarios")
      .update({ ai_summary: text })
      .eq("id", data.scenario_id);
    return { text };
  });