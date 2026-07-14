import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, updateProfile } from "@/lib/settings.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { HelpCircle, SlidersHorizontal, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Wealth Flightpath" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const qc = useQueryClient();
  const pFn = useServerFn(updateProfile);

  const [p, setP] = useState({
    display_name: data.profile?.display_name ?? "",
    base_currency: data.profile?.base_currency ?? "GBP",
    alt_currency: (data.profile as { alt_currency?: string | null } | null)?.alt_currency ?? "",
  });
  useEffect(() => {
    setP({
      display_name: data.profile?.display_name ?? "",
      base_currency: data.profile?.base_currency ?? "GBP",
      alt_currency: (data.profile as { alt_currency?: string | null } | null)?.alt_currency ?? "",
    });
  }, [data]);

  const saveP = useMutation({
    mutationFn: () => pFn({ data: { ...p, alt_currency: p.alt_currency ? p.alt_currency : null } }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["fx-alt"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Settings" description="How the application looks and behaves." />
      <TooltipProvider delayDuration={150}>
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile & Display</CardTitle>
              <CardDescription>How the app addresses you and shows currency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Display name" help="The name the app uses to greet you. Cosmetic only — no effect on calculations.">
                <Input value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
              </Field>
              <Field label="Base currency" help="ISO 4217 code (e.g. GBP) used as the reporting currency across the app. Every KPI, chart and projection is expressed in it.">
                <Input value={p.base_currency} onChange={(e) => setP({ ...p, base_currency: e.target.value.toUpperCase().slice(0, 3) })} />
              </Field>
              <Field label="Alternative currency (optional)" help="A secondary ISO code (e.g. USD, ZAR) shown next to base-currency values on the Dashboard. Spot rate is fetched from Google Finance with a Frankfurter fallback.">
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
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Planning Assumptions
              </CardTitle>
              <CardDescription>
                The numbers that drive projections now live in their own centre — with confidence ratings, review dates and a full change history for each one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/assumptions"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Open Planning Assumptions <ArrowRight className="h-4 w-4" />
              </Link>
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