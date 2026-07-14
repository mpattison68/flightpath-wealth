import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import * as XLSX from "xlsx";

const ExtractInput = z.object({
  filename: z.string(),
  mimeType: z.string(),
  base64: z.string().min(1),
});

const ExtractedHolding = z.object({
  name: z.string(),
  ticker: z.string().nullable().optional(),
  asset_class: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  currency: z.string().default("GBP"),
  units: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  value: z.number(),
  wrapper: z.string().nullable().optional(),
});

export type ExtractedHoldingT = z.infer<typeof ExtractedHolding>;

const SYSTEM_PROMPT = `You extract investment holdings from broker/pension statements or spreadsheets.
Return STRICT JSON: { "holdings": [ { "name": string, "ticker": string|null, "asset_class": "equity"|"bond"|"cash"|"alt"|"property"|null, "region": "uk"|"us"|"eu"|"em"|"global"|null, "currency": string (ISO 4217, default "GBP"), "units": number|null, "price": number|null, "value": number, "wrapper": "isa"|"sipp"|"gia"|"pension"|"other"|null } ] }.
Rules:
- "value" is the current market value of the position in its native currency. Numeric only, no symbols/commas.
- Infer asset_class and region from the fund/ETF name where obvious; otherwise null.
- Infer wrapper from account/statement context (ISA, SIPP, pension, GIA); otherwise null.
- Do NOT include totals, cash balances labelled "total", fees, or transactions.
- If a row is clearly not a holding (heading, disclosure), skip it.
- If nothing can be extracted, return { "holdings": [] }.
- Output JSON only, no prose.`;

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const buf = Buffer.from(clean, "base64");
  return new Uint8Array(buf);
}

function spreadsheetToText(bytes: Uint8Array): string {
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    parts.push(`# Sheet: ${name}\n${csv}`);
  }
  return parts.join("\n\n").slice(0, 60_000);
}

function csvBytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes).slice(0, 60_000);
}

async function callGateway(messages: unknown[]): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up your workspace.");
    throw new Error(`AI extraction failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned no content");
  return content;
}

export const extractHoldingsFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const bytes = decodeBase64(data.base64);
    const mime = data.mimeType.toLowerCase();
    const filename = data.filename.toLowerCase();

    let messages: unknown[];

    const isSpreadsheet =
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      filename.endsWith(".xlsx") ||
      filename.endsWith(".xls");
    const isCsv = mime === "text/csv" || filename.endsWith(".csv");
    const isImage = mime.startsWith("image/");
    const isPdf = mime === "application/pdf" || filename.endsWith(".pdf");

    if (isSpreadsheet) {
      const text = spreadsheetToText(bytes);
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract holdings from this spreadsheet (${data.filename}):\n\n${text}`,
        },
      ];
    } else if (isCsv) {
      const text = csvBytesToText(bytes);
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract holdings from this CSV (${data.filename}):\n\n${text}`,
        },
      ];
    } else if (isImage) {
      const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract holdings from this statement image (${data.filename}).` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ];
    } else if (isPdf) {
      const b64 = Buffer.from(bytes).toString("base64");
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract holdings from this PDF statement (${data.filename}).` },
            {
              type: "file",
              file: {
                filename: data.filename,
                file_data: `data:application/pdf;base64,${b64}`,
              },
            },
          ],
        },
      ];
    } else {
      throw new Error(`Unsupported file type: ${data.mimeType || data.filename}`);
    }

    const content = await callGateway(messages);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Some models wrap JSON in fences; try to extract.
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned non-JSON content");
      parsed = JSON.parse(m[0]);
    }

    const shape = z.object({ holdings: z.array(ExtractedHolding) });
    const result = shape.safeParse(parsed);
    if (!result.success) {
      // Try to salvage — coerce partial rows.
      const raw = (parsed as { holdings?: unknown[] })?.holdings ?? [];
      const salvaged = raw
        .map((r) => ExtractedHolding.safeParse(r))
        .filter((r): r is { success: true; data: ExtractedHoldingT } => r.success)
        .map((r) => r.data);
      return { holdings: salvaged };
    }
    return result.data;
  });

const BulkInput = z.object({
  holdings: z.array(
    z.object({
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
    }),
  ),
  createSnapshot: z.boolean().default(true),
  notes: z.string().optional(),
});

export const bulkInsertHoldings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.holdings.length === 0) return { inserted: 0, snapshot: null };
    const rows = data.holdings.map((h) => ({ ...h, user_id: context.userId }));
    const { error } = await context.supabase.from("holdings").insert(rows);
    if (error) throw new Error(error.message);

    let snapshot = null as null | { id: string };
    if (data.createSnapshot) {
      const { data: all, error: hErr } = await context.supabase.from("holdings").select("*");
      if (hErr) throw new Error(hErr.message);
      const total = (all ?? []).reduce((a, h) => a + Number(h.value ?? 0), 0);
      const { data: snap, error: sErr } = await context.supabase
        .from("valuation_snapshots")
        .insert({
          user_id: context.userId,
          total_value: total,
          source: "import",
          notes: data.notes ?? `Imported ${data.holdings.length} holding(s)`,
        })
        .select()
        .single();
      if (sErr) throw new Error(sErr.message);
      snapshot = snap;
      if (all && all.length > 0) {
        const lines = all.map((h) => ({
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
        await context.supabase.from("snapshot_holdings").insert(lines);
      }
    }
    return { inserted: data.holdings.length, snapshot };
  });