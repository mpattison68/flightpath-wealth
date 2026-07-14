import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, updateAssumptions, updateProfile } from "@/lib/settings.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Wealth Flightpath" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

const DEFAULT_ASSUMPTIONS = {
  inflation_pct: 2.5, real_growth_pct: 4, swr_pct: 3.5,
  life_expectancy: 92, fire_target: 1_500_000, liquid_fire_target: 900_000,
};

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const qc = useQueryClient();
  const aFn = useServerFn(updateAssumptions);
  const pFn = useServerFn(updateProfile);

  const [a, setA] = useState({ ...DEFAULT_ASSUMPTIONS, ...((data.settings?.assumptions as object) ?? {}) });
  const [p, setP] = useState({
    display_name: data.profile?.display_name ?? "",
    base_currency: data.profile?.base_currency ?? "GBP",
    alt_currency: (data.profile as { alt_currency?: string | null } | null)?.alt_currency ?? "",
  });
  useEffect(() => {
    setA({ ...DEFAULT_ASSUMPTIONS, ...((data.settings?.assumptions as object) ?? {}) });
    setP({
      display_name: data.profile?.display_name ?? "",
      base_currency: data.profile?.base_currency ?? "GBP",
      alt_currency: (data.profile as { alt_currency?: string | null } | null)?.alt_currency ?? "",
    });
  }, [data]);

  const saveA = useMutation({
    mutationFn: () => aFn({ data: a }),
    onSuccess: () => { toast.success("Assumptions saved"); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveP = useMutation({
    mutationFn: () => pFn({ data: { ...p, alt_currency: p.alt_currency ? p.alt_currency : null } }),
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["fx-alt"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Settings" description="Your assumptions drive every calculation." />
      <TooltipProvider delayDuration={150}>
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle><CardDescription>How the app addresses you.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Display name" help="The name the app uses to greet you. Cosmetic only — has no effect on calculations."><Input value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></Field>
            <Field label="Base currency" help="ISO 4217 code (e.g. GBP) used as the reporting currency across the app. All holdings are converted to this currency using stored FX rates, and every KPI, chart and projection is expressed in it."><Input value={p.base_currency} onChange={(e) => setP({ ...p, base_currency: e.target.value.toUpperCase().slice(0, 3) })} /></Field>
            <Field label="Alternative currency (optional)" help="A secondary ISO code (e.g. USD, EUR, ZAR) shown next to base-currency values on the Dashboard. Spot rate is fetched from Google Finance (with a Frankfurter fallback) and cached for a few minutes. Leave blank to hide.">
              <Input
                placeholder="e.g. USD, EUR"
                value={p.alt_currency ?? ""}
                onChange={(e) => setP({ ...p, alt_currency: e.target.value.toUpperCase().slice(0, 3) })}
              />
            </Field>
            <Button onClick={() => saveP.mutate()} disabled={saveP.isPending}>Save profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Assumptions</CardTitle><CardDescription>The numbers behind every projection.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Inflation %" help="Expected long-run annual inflation rate. Used to discount future values to today's money in retirement and scenario projections. A higher number makes future goals look more expensive in real terms."><Input type="number" step="0.1" value={a.inflation_pct} onChange={(e) => setA({ ...a, inflation_pct: Number(e.target.value) })} /></Field>
            <Field label="Real growth %" help="Expected annual portfolio return above inflation (i.e. real, not nominal). Drives the compounding curve in retirement projections and scenarios. Typical globally-diversified equity assumption is 3–5%."><Input type="number" step="0.1" value={a.real_growth_pct} onChange={(e) => setA({ ...a, real_growth_pct: Number(e.target.value) })} /></Field>
            <Field label="Safe withdrawal rate %" help="The percentage of your portfolio you assume you can withdraw each year in retirement without running out. Used to derive your implied FIRE number (annual spend ÷ SWR). Classic figure is 4%; more conservative plans use 3–3.5%."><Input type="number" step="0.1" value={a.swr_pct} onChange={(e) => setA({ ...a, swr_pct: Number(e.target.value) })} /></Field>
            <Field label="Life expectancy" help="Age you plan the portfolio to last until. Sets the end of the retirement projection horizon and affects sustainability / depletion calculations."><Input type="number" value={a.life_expectancy} onChange={(e) => setA({ ...a, life_expectancy: Number(e.target.value) })} /></Field>
            <Field label="FIRE target (GBP)" help="Total net worth (all assets, including illiquid ones like property and pensions) at which you consider yourself financially independent. Drives the 'progress to FIRE' KPI on the Dashboard."><Input type="number" value={a.fire_target} onChange={(e) => setA({ ...a, fire_target: Number(e.target.value) })} /></Field>
            <Field label="Liquid FIRE target (GBP)" help="The subset of your FIRE number that must be in liquid, drawable assets (investments, cash) — excluding property and locked pensions. Used to gauge whether you could actually retire today on accessible wealth."><Input type="number" value={a.liquid_fire_target} onChange={(e) => setA({ ...a, liquid_fire_target: Number(e.target.value) })} /></Field>
            <Button onClick={() => saveA.mutate()} disabled={saveA.isPending}>Save assumptions</Button>
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>
    </>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        {help ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{help}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {children}
    </div>
  );
}