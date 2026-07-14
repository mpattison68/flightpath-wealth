import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { compareScenarios } from "@/lib/scenarios.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { investmentCurrency, targetCurrency } from "@/lib/currency";
import type { ProjectionOutput } from "@/lib/finance/projection";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const searchSchema = z.object({ ids: z.string().catch("") });

export const Route = createFileRoute("/_authenticated/scenarios/compare")({
  head: () => ({ meta: [{ title: "Compare Scenarios — Wealth Flightpath" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ComparePage,
});

function ComparePage() {
  const { ids } = Route.useSearch();
  const idList = ids.split(",").filter(Boolean);
  const dashQuery = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboardData() });
  const cmp = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => compareScenarios({ data: { ids: idList } }),
    enabled: idList.length > 0,
  });

  const invCcy = investmentCurrency(dashQuery.data?.profile);
  const tgtCcy = targetCurrency(dashQuery.data?.profile);

  const rows = cmp.data ?? [];
  const chartData = buildChart(rows);

  return (
    <>
      <PageHeader
        title="Compare scenarios"
        description="Side-by-side outcomes for up to four strategies."
        actions={<Link to="/scenarios"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Library</Button></Link>}
      />
      <div className="space-y-4 p-6">
        {idList.length < 2 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Select 2–4 scenarios in the Library to compare.</CardContent></Card>
        ) : cmp.isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Computing…</CardContent></Card>
        ) : (
          <>
            <div className={"grid gap-3 " + gridCols(rows.length)}>
              {rows.map((r) => (
                <Card key={r.scenario.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{r.scenario.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{r.scenario.scenario_type}</Badge>
                      <span className="capitalize">{r.scenario.status}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <Row label="Success" value={`${r.projection.summary.successProbability}/100`} />
                    <Row label="Retirement" value={`${r.projection.summary.retirementAge} · ${r.projection.summary.retirementYear}`} />
                    <Row label="Lowest RPPI" value={`${r.projection.summary.lowestPurchasingPower.toFixed(2)}×`} />
                    <Row label="Max drawdown" value={formatPercent(r.projection.summary.maxDrawdownPct)} />
                    <Row label="Years under pressure" value={String(r.projection.summary.yearsUnderPressure)} />
                    <Row label="Avg spend" value={formatCurrency(r.projection.summary.averageSpendingTgt, tgtCcy)} />
                    <Row label="Peak wealth" value={formatCurrency(r.projection.summary.peakWealth, invCcy)} />
                    <Row label="Final legacy" value={formatCurrency(r.projection.summary.finalLegacyTgt, tgtCcy)} />
                    <Row label="Depleted" value={r.projection.summary.depleted ? `age ${r.projection.summary.depletedAtAge}` : "no"} tone={r.projection.summary.depleted ? "warning" : "positive"} />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Purchasing power over time ({tgtCcy})</CardTitle>
                <CardDescription>1× = today's lifestyle fully funded.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={50} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {rows.map((r, i) => (
                      <Line key={r.scenario.id} type="monotone" dataKey={r.scenario.name} stroke={`var(--color-chart-${(i % 5) + 1})`} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Total wealth over time ({invCcy})</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={buildWealthChart(rows)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickFormatter={(v) => formatCurrency(v, invCcy)} />
                    <Tooltip formatter={(v: number) => formatCurrency(v, invCcy)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {rows.map((r, i) => (
                      <Line key={r.scenario.id} type="monotone" dataKey={r.scenario.name} stroke={`var(--color-chart-${(i % 5) + 1})`} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "positive" | "warning" }) {
  const cls = tone === "warning" ? "text-status-warning" : tone === "positive" ? "text-status-positive" : "";
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={"tabular-nums font-medium " + cls}>{value}</span>
    </div>
  );
}

function gridCols(n: number): string {
  if (n <= 1) return "sm:grid-cols-1";
  if (n === 2) return "sm:grid-cols-2";
  if (n === 3) return "sm:grid-cols-3";
  return "sm:grid-cols-2 lg:grid-cols-4";
}

function buildChart(rows: { scenario: { name: string }; projection: ProjectionOutput }[]): Record<string, number>[] {
  const yearMap = new Map<number, Record<string, number>>();
  for (const r of rows) {
    for (const y of r.projection.years) {
      const row = yearMap.get(y.year) ?? { year: y.year };
      row[r.scenario.name] = Number(y.purchasingPowerIndex.toFixed(3));
      yearMap.set(y.year, row);
    }
  }
  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

function buildWealthChart(rows: { scenario: { name: string }; projection: ProjectionOutput }[]): Record<string, number>[] {
  const yearMap = new Map<number, Record<string, number>>();
  for (const r of rows) {
    for (const y of r.projection.years) {
      const row = yearMap.get(y.year) ?? { year: y.year };
      row[r.scenario.name] = Math.round(y.totalWealth);
      yearMap.set(y.year, row);
    }
  }
  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}