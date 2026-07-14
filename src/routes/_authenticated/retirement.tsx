import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivePlan, upsertActivePlan } from "@/lib/retirement.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { listEngines } from "@/lib/engines.functions";
import { listAssumptions } from "@/lib/assumptions.functions";
import { listSpending } from "@/lib/spending.functions";
import { getSpotRate } from "@/lib/fx.functions";
import { assumptionMap, get as getA } from "@/lib/assumptions/values";
import { investmentCurrency, targetCurrency, needsFx } from "@/lib/currency";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { WorldBadge } from "@/components/world-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  sumValue, sustainableIncome, fireProgress, yearsBetween, projectFutureValue,
  readinessScore, dynamicFireTarget, toInvestment, rppi,
  type Assumptions, type Holding,
} from "@/lib/finance/calculators";
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

  // Currency model — Investment vs Target.
  const invCcy = investmentCurrency(dash.profile);
  const tgtCcy = targetCurrency(dash.profile);
  const hasFx = needsFx(dash.profile);
  const fxQuery = useQuery({
    queryKey: ["fx-alt", invCcy, tgtCcy],
    queryFn: () => getSpotRate({ data: { from: invCcy, to: tgtCcy } }),
    enabled: hasFx,
    staleTime: 5 * 60 * 1000,
  });
  const fx = hasFx ? (fxQuery.data?.rate ?? 1) : 1;

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

  // Portfolio lives in Investment Currency.
  const totalInv = sumValue(dash.holdings as Holding[]);
  const years = form.target_retirement_date ? Math.max(0, yearsBetween(new Date(), new Date(form.target_retirement_date))) : 0;
  const projectedInv = projectFutureValue(totalInv, 0, years, equityReal);
  const sustainableInv = sustainableIncome(projectedInv, swrPct);
  // Retirement engine outputs are in Target Currency.
  const sustainableTgt = sustainableInv * fx;

  // -------- Dynamic FIRE — computed in Target Currency ------------------
  const retirementYear = form.target_retirement_date
    ? new Date(form.target_retirement_date).getFullYear()
    : new Date().getFullYear() + Math.round(years);
  // Spending is stored (and now displayed) in Target Currency.
  const totalSpendingTgt = spending.reduce((s, r) => s + Number(r.annual_amount ?? 0), 0)
    || form.desired_annual_income;
  const statePensionYear = getA(aMap, "state_pension.start_date", 2045);
  const statePensionInv = retirementYear >= statePensionYear
    ? getA(aMap, "state_pension.amount", 0) * (getA(aMap, "state_pension.confidence", 100) / 100)
    : 0;
  const statePensionTgt = statePensionInv * fx;
  const consultingStart = getA(aMap, "consulting.start", 0);
  const consultingDuration = getA(aMap, "consulting.duration", 0);
  const consultingActive = retirementYear >= consultingStart && retirementYear < consultingStart + consultingDuration;
  const consultingInv = consultingActive
    ? getA(aMap, "consulting.annual_income", 0) * (getA(aMap, "consulting.probability", 0) / 100)
    : 0;
  const consultingTgt = consultingInv * fx;

  const fireDynamic = dynamicFireTarget({
    targetSpending: totalSpendingTgt,
    guaranteedIncome: statePensionTgt,
    expectedIncome: consultingTgt,
    swrPct,
  });
  // requiredCapital is in Target Currency — convert back to Investment
  // Currency to compare against the portfolio.
  const requiredCapitalInv = toInvestment(fireDynamic.requiredCapital, fx);
  const fire = fireProgress(totalInv, requiredCapitalInv || assumptions.fire_target);
  const score = readinessScore({
    current: totalInv * fx,
    fireTarget: fireDynamic.requiredCapital || assumptions.fire_target * fx,
    projectedAtRetirement: projectedInv * fx,
    desiredIncome: totalSpendingTgt,
    swrPct,
  });

  // Retirement Purchasing Power Index — after growth, FX drift and target inflation.
  const targetInflationPct = getA(aMap, "inflation.target", getA(aMap, "inflation.uk", assumptions.inflation_pct));
  const fxDriftPct = getA(aMap, "fx.drift", 0);
  const rppiValue = rppi({ years, realGrowthPct: equityReal, fxDriftPct, targetInflationPct });

  const flightpath = useMemo(() => {
    const points: { year: number; value: number }[] = [];
    const totalYears = Math.ceil(years) + 10;
    for (let y = 0; y <= totalYears; y++) {
      points.push({ year: new Date().getFullYear() + y, value: projectFutureValue(totalInv, 0, y, equityReal) });
    }
    return points;
  }, [totalInv, years, equityReal]);

  const engineTiles = engines.map((e) => {
    let projectedIncome = 0; // in Target Currency
    let subtitle = "";
    switch (e.kind) {
      case "portfolio":
        projectedIncome = sustainableTgt;
        subtitle = `${swrPct}% of ${formatCurrency(projectedInv, invCcy)}`;
        break;
      case "state_pension":
        projectedIncome = statePensionTgt;
        subtitle = statePensionInv > 0 ? `from ${statePensionYear}` : `starts ${statePensionYear}`;
        break;
      case "consulting":
        projectedIncome = consultingTgt;
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
      <PageHeader
        title="Retirement Flightpath"
        description="The bridge between your Wealth World and your Lifestyle World. Every number below asks the same question: can Investment-Currency wealth keep funding a Target-Currency lifestyle?"
        actions={
          <div className="flex items-center gap-2">
            <WorldBadge world="wealth" currency={invCcy} />
            <span className="text-xs text-muted-foreground">→</span>
            <WorldBadge world="lifestyle" currency={tgtCcy} />
          </div>
        }
      />
      <div className="space-y-6 p-6">
        {hasFx ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Wealth is <em>accumulated</em> in <strong>{invCcy}</strong> and <em>consumed</em> in <strong>{tgtCcy}</strong>.
            {fxQuery.data ? ` Spot: 1 ${invCcy} = ${fx.toFixed(4)} ${tgtCcy}.` : fxQuery.isLoading ? " Fetching FX…" : ""}
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Financial Engines</CardTitle>
            <CardDescription>Retirement is funded by several independent income engines. Income shown in {tgtCcy}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {engineTiles.map((e) => (
              <div key={e.id} className="rounded-md border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">{e.label}</div>
                  <Badge variant="outline" className="text-[10px] capitalize">{e.status}</Badge>
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {e.projectedIncome > 0 ? formatCurrency(e.projectedIncome, tgtCcy) : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">{e.subtitle}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Years remaining" value={years > 0 ? years.toFixed(1) : "—"} />
          <KpiCard label="Projected portfolio at retirement" value={formatCurrency(projectedInv, invCcy)} hint={`At ${equityReal}% real · ${invCcy}`} />
          <KpiCard
            label="Dynamic FIRE target"
            value={formatCurrency(fireDynamic.requiredCapital, tgtCcy)}
            hint={`Spend ${formatCurrency(fireDynamic.targetSpending, tgtCcy)} − income ${formatCurrency(fireDynamic.guaranteedIncome + fireDynamic.expectedIncome, tgtCcy)}`}
            tone={totalInv >= requiredCapitalInv ? "positive" : "neutral"}
          />
          <KpiCard
            label="Readiness score"
            value={`${score}/100`}
            tone={score >= 80 ? "positive" : score >= 50 ? "neutral" : "warning"}
            hint={`FIRE ${formatPercent(fire)} · Sustainable ${formatCurrency(sustainableTgt, tgtCcy)}`}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Retirement Purchasing Power</CardTitle>
                <CardDescription>
                  The primary retirement metric. Success is measured in {tgtCcy} purchasing power — not {invCcy} portfolio growth.
                </CardDescription>
              </div>
              <WorldBadge world="lifestyle" currency={tgtCcy} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="RPPI at retirement" value={rppiValue > 0 ? `${rppiValue.toFixed(2)}×` : "—"} hint={`${years.toFixed(1)}y · ${equityReal}% real · ${fxDriftPct}% fx · ${targetInflationPct}% infl`} tone={rppiValue >= 1 ? "positive" : "warning"} />
            <KpiCard label={`FIRE target in ${invCcy}`} value={formatCurrency(requiredCapitalInv, invCcy)} hint={`= ${formatCurrency(fireDynamic.requiredCapital, tgtCcy)} at today's spot`} />
            <KpiCard label={`Portfolio in ${tgtCcy}`} value={formatCurrency(totalInv * fx, tgtCcy)} hint="Today's spot — the lifestyle it could fund now" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flightpath & Timeline</CardTitle>
            <CardDescription>Projected portfolio value in today's money ({invCcy}), with key milestones marked.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flightpath} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickFormatter={(v) => formatCurrency(v, invCcy)} />
                <Tooltip formatter={(v: number) => formatCurrency(v, invCcy)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={requiredCapitalInv} stroke="var(--color-status-positive)" strokeDasharray="4 4" label={{ value: `FIRE ${formatCurrency(requiredCapitalInv, invCcy)}`, fontSize: 10, fill: "var(--color-muted-foreground)" }} />
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
            <CardDescription>How each engine contributes to sustainable retirement income, in {tgtCcy}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {engineTiles.filter((e) => e.status !== "future").map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{e.label}</div>
                  <div className="text-xs text-muted-foreground capitalize">{e.subtitle}</div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-medium">{e.projectedIncome > 0 ? formatCurrency(e.projectedIncome, tgtCcy) : "—"}</div>
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
              <Field label={`Desired annual income (${tgtCcy})`}><Input type="number" value={form.desired_annual_income} onChange={(e) => setForm({ ...form, desired_annual_income: Number(e.target.value) })} /></Field>
              <Field label={`Current annual spend (${tgtCcy})`}><Input type="number" value={form.current_annual_spend} onChange={(e) => setForm({ ...form, current_annual_spend: Number(e.target.value) })} /></Field>
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
