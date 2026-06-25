import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listHoldings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("holdings")
      .select("*")
      .order("value", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const HoldingInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  ticker: z.string().nullable().optional(),
  asset_class: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  currency: z.string().default("GBP"),
  units: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  value: z.number().nonnegative(),
  wrapper: z.string().nullable().optional(),
  liquidity: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const upsertHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HoldingInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: result, error } = await context.supabase
      .from("holdings")
      .upsert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("holdings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ notes: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: holdings, error: hErr } = await context.supabase.from("holdings").select("*");
    if (hErr) throw new Error(hErr.message);
    const total = (holdings ?? []).reduce((a, h) => a + Number(h.value ?? 0), 0);
    const { data: snap, error: sErr } = await context.supabase
      .from("valuation_snapshots")
      .insert({
        user_id: context.userId,
        total_value: total,
        source: "manual",
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (sErr) throw new Error(sErr.message);
    if (holdings && holdings.length > 0) {
      const rows = holdings.map((h) => ({
        snapshot_id: snap.id,
        user_id: context.userId,
        name: h.name,
        ticker: h.ticker,
        asset_class: h.asset_class,
        region: h.region,
        currency: h.currency,
        units: h.units,
        price: h.price,
        value: h.value,
        wrapper: h.wrapper,
      }));
      const { error: lErr } = await context.supabase.from("snapshot_holdings").insert(rows);
      if (lErr) throw new Error(lErr.message);
    }
    return snap;
  });

export const listSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("valuation_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });