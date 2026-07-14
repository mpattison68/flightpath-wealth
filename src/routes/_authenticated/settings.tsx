import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, updateAssumptions, updateProfile } from "@/lib/settings.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle><CardDescription>How the app addresses you.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Display name"><Input value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></Field>
            <Field label="Base currency"><Input value={p.base_currency} onChange={(e) => setP({ ...p, base_currency: e.target.value.toUpperCase().slice(0, 3) })} /></Field>
            <Field label="Alternative currency (optional)">
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
            <Field label="Inflation %"><Input type="number" step="0.1" value={a.inflation_pct} onChange={(e) => setA({ ...a, inflation_pct: Number(e.target.value) })} /></Field>
            <Field label="Real growth %"><Input type="number" step="0.1" value={a.real_growth_pct} onChange={(e) => setA({ ...a, real_growth_pct: Number(e.target.value) })} /></Field>
            <Field label="Safe withdrawal rate %"><Input type="number" step="0.1" value={a.swr_pct} onChange={(e) => setA({ ...a, swr_pct: Number(e.target.value) })} /></Field>
            <Field label="Life expectancy"><Input type="number" value={a.life_expectancy} onChange={(e) => setA({ ...a, life_expectancy: Number(e.target.value) })} /></Field>
            <Field label="FIRE target (GBP)"><Input type="number" value={a.fire_target} onChange={(e) => setA({ ...a, fire_target: Number(e.target.value) })} /></Field>
            <Field label="Liquid FIRE target (GBP)"><Input type="number" value={a.liquid_fire_target} onChange={(e) => setA({ ...a, liquid_fire_target: Number(e.target.value) })} /></Field>
            <Button onClick={() => saveA.mutate()} disabled={saveA.isPending}>Save assumptions</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}