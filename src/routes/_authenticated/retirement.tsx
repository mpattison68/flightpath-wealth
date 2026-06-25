import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivePlan, upsertActivePlan } from "@/lib/retirement.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { sumValue, sustainableIncome, fireProgress, yearsBetween, projectFutureValue, readinessScore, type Assumptions, type Holding } from "@/lib/finance/calculators";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

const planQuery = queryOptions({ queryKey: ["plan"], queryFn: () => getActivePlan() });
const dashQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardData() });

export const Route = createFileRoute("/_authenticated/retirement")({
  head: () => ({ meta: [{ title: "Retirement — Wealth Flightpath" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(planQuery),
    context.queryClient.ensureQueryData(dashQuery),
  ]),
  component: RetirementPage,
});

const DEFAULT_ASSUMPTIONS: Assumptions = {
  inflation_pct: 2.5, real_growth_pct: 4, swr_pct: 3.5,
  life_expectancy: 92, fire_target: 1_500_000, liquid_fire_target: 900_000,
};

function RetirementPage() {
  const { data: plan } = useSuspenseQuery(planQuery);
  const { data: dash } = useSuspenseQuery(dashQuery);
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertActivePlan);

  const [form, setForm] = useState({
    name: plan?.name ?? "Active Plan",
    date_of_birth: plan?.date_of_birth ?? "",
    target_retirement_date: plan?.target_retirement_date ?? "",
    desired_annual_income: Number(plan?.desired_annual_income ?? 40000),
    current_annual_spend: Number(plan?.current_annual_spend ?? 30000),
  });
  useEffect(() => {
    if (plan) setForm({
      name: plan.name ?? "Active Plan",
      date_of_birth: plan.date_of_birth ?? "",
      target_retirement_date: plan.target_retirement_date ?? "",
      desired_annual_income: Number(plan.desired_annual_income ?? 40000),
      current_annual_spend: Number(plan.current_annual_spend ?? 30000),
    });
  }, [plan]);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      name: form.name,
      date_of_birth: form.date_of_birth || null,
      target_retirement_date: form.target_retirement_date || null,
      desired_annual_income: form.desired_annual_income,
      current_annual_spend: form.current_annual_spend,
    }}),
    onSuccess: () => {
      toast.success("Plan saved");
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS, ...((dash.settings?.assumptions as object) ?? {}) };
  const total = sumValue(dash.holdings as Holding[]);
  const years = form.target_retirement_date ? Math.max(0, yearsBetween(new Date(), new Date(form.target_retirement_date))) : 0;
  const projected = projectFutureValue(total, 0, years, assumptions.real_growth_pct);
  const sustainable = sustainableIncome(projected, assumptions.swr_pct);
  const fire = fireProgress(total, assumptions.fire_target);
  const score = readinessScore({
    current: total,
    fireTarget: assumptions.fire_target,
    projectedAtRetirement: projected,
    desiredIncome: form.desired_annual_income,
    swrPct: assumptions.swr_pct,
  });

  const flightpath = useMemo(() => {
    const points: { year: number; value: number }[] = [];
    const totalYears = Math.ceil(years) + 10;
    for (let y = 0; y <= totalYears; y++) {
      points.push({ year: new Date().getFullYear() + y, value: projectFutureValue(total, 0, y, assumptions.real_growth_pct) });
    }
    return points;
  }, [total, years, assumptions.real_growth_pct]);

  return (
    <>
      <PageHeader title="Retirement Flightpath" description="Your journey to retirement, continuously monitored." />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Years remaining" value={years > 0 ? years.toFixed(1) : "—"} />
          <KpiCard label="Projected at retirement" value={formatCurrency(projected)} hint={`At ${assumptions.real_growth_pct}% real`} />
          <KpiCard label="Sustainable income" value={formatCurrency(sustainable)} hint={`vs target ${formatCurrency(form.desired_annual_income)}`} tone={sustainable >= form.desired_annual_income ? "positive" : "warning"} />
          <KpiCard label="Readiness score" value={`${score}/100`} tone={score >= 80 ? "positive" : score >= 50 ? "neutral" : "warning"} hint={`FIRE ${formatPercent(fire)}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flightpath</CardTitle>
            <CardDescription>Projected portfolio value in today's money.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flightpath} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={assumptions.fire_target} stroke="var(--color-status-positive)" strokeDasharray="4 4" label={{ value: "FIRE target", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                {form.target_retirement_date ? (
                  <ReferenceLine x={new Date(form.target_retirement_date).getFullYear()} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: "Retire", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                ) : null}
                <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your plan</CardTitle>
            <CardDescription>The numbers above are calculated from these inputs and your portfolio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth"><Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></Field>
              <Field label="Target retirement date"><Input type="date" value={form.target_retirement_date ?? ""} onChange={(e) => setForm({ ...form, target_retirement_date: e.target.value })} /></Field>
              <Field label="Desired annual income (GBP)"><Input type="number" value={form.desired_annual_income} onChange={(e) => setForm({ ...form, desired_annual_income: Number(e.target.value) })} /></Field>
              <Field label="Current annual spend (GBP)"><Input type="number" value={form.current_annual_spend} onChange={(e) => setForm({ ...form, current_annual_spend: Number(e.target.value) })} /></Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>Save plan</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}