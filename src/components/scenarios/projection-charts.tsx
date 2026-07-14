import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, AreaChart, Area, Legend } from "recharts";
import type { ProjectionOutput } from "@/lib/finance/projection";
import { formatCurrency } from "@/lib/format";

export function WealthChart({ projection, invCcy }: { projection: ProjectionOutput; invCcy: string }) {
  const data = projection.years.map((y) => ({
    year: y.year, Portfolio: Math.round(y.portfolioEnd), Property: Math.round(y.property), Cash: Math.round(y.cash),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickFormatter={(v) => formatCurrency(v, invCcy)} />
        <Tooltip formatter={(v: number) => formatCurrency(v, invCcy)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine x={projection.summary.retirementYear} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: "Retire", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
        <Area type="monotone" dataKey="Portfolio" stackId="w" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.5} />
        <Area type="monotone" dataKey="Property" stackId="w" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.4} />
        <Area type="monotone" dataKey="Cash" stackId="w" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.4} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function IncomeChart({ projection, tgtCcy }: { projection: ProjectionOutput; tgtCcy: string }) {
  const data = projection.years.filter((y) => y.isRetired).map((y) => ({
    year: y.year,
    Spending: Math.round(y.spendingTgt),
    Income: Math.round(y.totalIncomeTgt),
    Sustainable: Math.round(y.sustainableIncomeTgt),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={80} tickFormatter={(v) => formatCurrency(v, tgtCcy)} />
        <Tooltip formatter={(v: number) => formatCurrency(v, tgtCcy)} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="Spending" stroke="var(--color-chart-4)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Income" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Sustainable" stroke="var(--color-status-positive)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PurchasingPowerChart({ projection }: { projection: ProjectionOutput }) {
  const data = projection.years.map((y) => ({ year: y.year, RPPI: Number(y.purchasingPowerIndex.toFixed(3)) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="year" stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={50} />
        <Tooltip formatter={(v: number) => `${v.toFixed(2)}×`} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
        <ReferenceLine y={1} stroke="var(--color-status-positive)" strokeDasharray="4 4" label={{ value: "Full lifestyle", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
        <ReferenceLine x={projection.summary.retirementYear} stroke="var(--color-primary)" strokeDasharray="4 4" label={{ value: "Retire", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
        <Line type="monotone" dataKey="RPPI" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}