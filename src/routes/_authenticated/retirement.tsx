import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivePlan, upsertActivePlan } from "@/lib/retirement.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { listEngines } from "@/lib/engines.functions";
import { listAssumptions } from "@/lib/assumptions.functions";
import { listSpending } from "@/lib/spending.functions";
import { assumptionMap, get as getA } from "@/lib/assumptions/values";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { sumValue, sustainableIncome, fireProgress, yearsBetween, projectFutureValue, readinessScore, dynamicFireTarget, type Assumptions, type Holding } from "@/lib/finance/calculators";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

const planQuery = queryOptions({ queryKey: ["plan"], queryFn: () => getActivePlan() });
const dashQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardData() });
const enginesQuery = queryOptions({ queryKey: ["engines"], queryFn: () => listEngines() });
const assumptionsQuery = queryOptions({ queryKey: ["assumptions"], queryFn: () => listAssumptions() });
const spendingQuery = queryOptions({ queryKey: ["spending"], queryFn: () => listSpending() });

export const Route = createFileRoute("/_authenticated/retirement")({
  head: () => ({ meta: [{ title: "Retirement — Wealth Flightpath" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(planQuery),
    context.queryClient.ensureQueryData(dashQuery),
    context.queryClient.ensureQueryData(enginesQuery),
    context.queryClient.ensureQueryData(assumptionsQuery),
    context.queryClient.ensureQueryData(spendingQuery),
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
  const { data: engines } = useSuspenseQuery(enginesQuery);
  const { data: assumptionRows } = useSuspenseQuery(assumptionsQuery);
  const { data: spending } = useSuspenseQuery(spendingQuery);
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
  const aMap = assumptionMap(assumptionRows);
  const swrPct = getA(aMap, "withdrawal.swr", assumptions.swr_pct);
  const equityReal = getA(aMap, "growth.equity_real", assumptions.real_growth_pct);
  const total = sumValue(dash.holdings as Holding[]);
  const years = form.target_retirement_date ? Math.max(0, yearsBetween(new Date(), new Date(form.target_retirement_date))) : 0;
  const projected = projectFutureValue(total, 0, years, equityReal);
  const sustainable = sustainableIncome(projected, swrPct);

  // -------- Dynamic FIRE target ---------------------------------------
  const retirementYear = form.target_retirement_date
    ? new Date(form.target_retirement_date).getFullYear()
    : new Date().getFullYear() + Math.round(years);
  const totalSpending = spending.reduce((s, r) => s + Number(r.annual_amount ?? 0), 0)
    || form.desired_annual_income;
  const statePensionYear = getA(aMap, "state_pension.start_date", 2045);
  const statePensionAmount = retirementYear >= statePensionYear
    ? getA(aMap, "state_pension.amount", 0) * (getA(aMap, "state_pension.confidence", 100) / 100)
    : 0;
  const consultingStart = getA(aMap, "consulting.start", 0);
  const consultingDuration = getA(aMap, "consulting.duration", 0);
  const consultingActive = retirementYear >= consultingStart && retirementYear < consultingStart + consultingDuration;
  const consultingExpected = consultingActive
    ? getA(aMap, "consulting.annual_income", 0) * (getA(aMap, "consulting.probability", 0) / 100)
    : 0;
  const fireDynamic = dynamicFireTarget({
    targetSpending: totalSpending,
    guaranteedIncome: statePensionAmount,
    expectedIncome: consultingExpected,
    swrPct,
  });
  const fire = fireProgress(total, fireDynamic.requiredCapital || assumptions.fire_target);
  const score = readinessScore({
    current: total,
    fireTarget: fireDynamic.requiredCapital || assumptions.fire_target,
    projectedAtRetirement: projected,
    desiredIncome: totalSpending,
    swrPct,
  });

  const flightpath = useMemo(() => {
    const points: { year: number; value: number }[] = [];
    const totalYears = Math.ceil(years) + 10;
    for (let y = 0; y <= totalYears; y++) {
      points.push({ year: new Date().getFullYear() + y, value: projectFutureValue(total, 0, y, equityReal) });
    }
    return points;
  }, [total, years, equityReal]);

  // Engine contributions at retirement year (informational tiles)
  const engineTiles = engines.map((e) => {
    let projectedIncome = 0;
    let subtitle = "";
    switch (e.kind) {
      case "portfolio":
        projectedIncome = sustainableIncome(projected, swrPct);
        subtitle = `${swrPct}% of ${formatCurrency(projected)}`;
        break;
      case "state_pension":
        projectedIncome = statePensionAmount;
        subtitle = statePensionAmount > 0 ? `from ${statePensionYear}` : `starts ${statePensionYear}`;
        break;
      case "consulting":
        projectedIncome = consultingExpected;
        subtitle = consultingActive ? "active at retirement" : "ends before retirement";
        break;
      case "property":
        projectedIncome = 0;
        subtitle = "capital release";
        break;
      default:
        subtitle = e.status;
    }
    return { ...e, projectedIncome, subtitle };
  });

  // Timeline milestones for reference lines
  const currentYear = new Date().getFullYear();
  const milestones = [
    { year: retirementYear, label: "Retire" },
    { year: statePensionYear, label: "State Pension" },
    { year: consultingStart, label: "Consulting starts" },
    { year: consultingStart + consultingDuration, label: "Consulting ends" },
    { year: getA(aMap, "property.sale_year", 0), label: "Property sale" },
  ].filter((m) => m.year >= currentYear && m.year <= currentYear + Math.ceil(years) + 10);

  return (
    <>
      <PageHeader title="Retirement Flightpath" description="Your journey to retirement, continuously monitored." />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Financial Engines</CardTitle>
            <CardDescription>Retirement is funded by several independent income engines working together.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {engineTiles.map((e) => (
              <div key={e.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">{e.label}</div>
                  <Badge variant="outline" className="text-[10px] capitalize">{e.status}</Badge>
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {e.projectedIncome > 0 ? formatCurrency(e.projectedIncome) : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">{e.subtitle}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Years remaining" value={years > 0 ? years.toFixed(1) : "—"} />
          <KpiCard label="Projected at retirement" value={formatCurrency(projected)} hint={`At ${equityReal}% real`} />
          <KpiCard
            label="Dynamic FIRE target"
            value={formatCurrency(fireDynamic.requiredCapital)}
            hint={`Spend ${formatCurrency(fireDynamic.targetSpending)} − income ${formatCurrency(fireDynamic.guaranteedIncome + fireDynamic.expectedIncome)}`}
            tone={total >= fireDynamic.requiredCapital ? "positive" : "neutral"}
          />
          <KpiCard label="Readiness score" value={`${score}/100`} tone={score >= 80 ? "positive" : score >= 50 ? "neutral" : "warning"} hint={`FIRE ${formatPercent(fire)} · Sustainable ${formatCurrency(sustainable)}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flightpath & Timeline</CardTitle>
            <CardDescription>Projected portfolio value in today's money, with key milestones marked.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flightpath} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={fireDynamic.requiredCapital} stroke="var(--color-status-positive)" strokeDasharray="4 4" label={{ value: "FIRE target", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                {milestones.map((m) => (
                  <ReferenceLine key={`${m.label}-${m.year}`} x={m.year} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: m.label, fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                ))}
                <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retirement Income Sources</CardTitle>
            <CardDescription>How each engine contributes to sustainable retirement income.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {engineTiles.filter((e) => e.status !== "future").map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{e.label}</div>
                  <div className="text-xs text-muted-foreground capitalize">{e.subtitle}</div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-medium">{e.projectedIncome > 0 ? formatCurrency(e.projectedIncome) : "—"}</div>
                  <div className="text-[10px] text-muted-foreground">{e.status}</div>
                </div>
              </div>
            ))}
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