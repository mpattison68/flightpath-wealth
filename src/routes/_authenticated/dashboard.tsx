import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/dashboard.functions";
import { getSpotRate } from "@/lib/fx.functions";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  sumValue, liquidValue, sustainableIncome, fireProgress, yearsBetween, allocation,
  type Holding, type Assumptions,
} from "@/lib/finance/calculators";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plane } from "lucide-react";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboardData(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Wealth Flightpath" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: DashboardPage,
});

const DEFAULT_ASSUMPTIONS: Assumptions = {
  inflation_pct: 2.5,
  real_growth_pct: 4,
  swr_pct: 3.5,
  life_expectancy: 92,
  fire_target: 1_500_000,
  liquid_fire_target: 900_000,
};

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const holdings = (data.holdings ?? []) as Holding[];
  const assumptions: Assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    ...((data.settings?.assumptions as object) ?? {}),
  };
  const currency = "GBP";
  const altCurrency = (data.profile as { alt_currency?: string | null } | null)?.alt_currency || null;

  const fxQuery = useQuery({
    queryKey: ["fx-alt", currency, altCurrency],
    queryFn: () => getSpotRate({ data: { from: currency, to: altCurrency! } }),
    enabled: !!altCurrency && altCurrency !== currency,
    staleTime: 5 * 60 * 1000,
  });
  const fxRate = fxQuery.data?.rate ?? null;
  const showAlt = !!altCurrency && !!fxRate;
  const alt = (v: number) => (showAlt ? ` · ${formatCurrency(v * (fxRate as number), altCurrency as string)}` : "");

  const total = sumValue(holdings);
  const liquid = liquidValue(holdings);
  const sustainable = sustainableIncome(total, assumptions.swr_pct);
  const fire = fireProgress(total, assumptions.fire_target);
  const liquidFire = fireProgress(liquid, assumptions.liquid_fire_target);
  const years = data.plan?.target_retirement_date
    ? Math.max(0, yearsBetween(new Date(), new Date(data.plan.target_retirement_date)))
    : null;

  const byClass = allocation(holdings, "asset_class");
  const snapshots = [...(data.snapshots ?? [])].reverse().map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
    value: Number(s.total_value),
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where you are today, and whether you're still on course."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/portfolio">Manage holdings</Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        {holdings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /> Start your flightpath</CardTitle>
              <CardDescription>Add your first holdings so we can show you where you stand.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild><Link to="/portfolio">Add holdings</Link></Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Portfolio value"
            value={formatCurrency(total, currency)}
            hint={`${holdings.length} holdings${alt(total)}`}
          />
          <KpiCard
            label="FIRE progress"
            value={formatPercent(fire)}
            hint={`Target ${formatCurrency(assumptions.fire_target, currency)}`}
            tone={fire >= 100 ? "positive" : fire >= 60 ? "neutral" : "warning"}
          />
          <KpiCard
            label="Liquid FIRE"
            value={formatPercent(liquidFire)}
            hint={`Liquid ${formatCurrency(liquid, currency)}${alt(liquid)}`}
          />
          <KpiCard
            label="Sustainable income"
            value={formatCurrency(sustainable, currency)}
            hint={`At ${assumptions.swr_pct}% SWR${alt(sustainable)}`}
          />
        </div>

        {altCurrency ? (
          <div className="text-xs text-muted-foreground">
            {fxQuery.isLoading
              ? `Fetching ${currency}/${altCurrency} spot rate…`
              : fxQuery.isError
                ? `Could not load ${currency}/${altCurrency} rate from Google Finance.`
                : fxRate
                  ? `Spot: 1 ${currency} = ${fxRate.toFixed(4)} ${altCurrency} (Google Finance)`
                  : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Portfolio over time</CardTitle>
              <CardDescription>How is the portfolio trending?</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {snapshots.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Create a snapshot from the Portfolio page to start tracking history.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snapshots} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={70} tickFormatter={(v) => formatCurrency(v, currency)} />
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-chart-1)" fill="url(#g1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocation by asset class</CardTitle>
              <CardDescription>How is the portfolio spread?</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {byClass.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byClass} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                      {byClass.map((_, i) => (
                        <Cell key={i} fill={`var(--color-chart-${(i % 8) + 1})`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retirement flightpath</CardTitle>
            <CardDescription>Am I still on course?</CardDescription>
          </CardHeader>
          <CardContent>
            {years === null ? (
              <div className="text-sm text-muted-foreground">
                Set a target retirement date in <Link to="/retirement" className="text-primary underline-offset-2 hover:underline">Retirement</Link> to see your flightpath.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="Years remaining" value={years.toFixed(1)} />
                <KpiCard label="Income sources" value={data.incomeSources.length} hint="Pensions, rental, annuities" />
                <KpiCard label="Latest snapshot" value={snapshots.length} hint={snapshots.length ? "snapshots stored" : "none yet"} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}