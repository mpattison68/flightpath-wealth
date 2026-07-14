import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSpending, updateSpending } from "@/lib/spending.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { targetCurrency } from "@/lib/currency";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorldBadge } from "@/components/world-badge";
import { formatCurrency } from "@/lib/format";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const spendingQuery = queryOptions({ queryKey: ["spending"], queryFn: () => listSpending() });
const dashQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardData() });

export const Route = createFileRoute("/_authenticated/spending")({
  head: () => ({
    meta: [
      { title: "Retirement Lifestyle — Wealth Flightpath" },
      { name: "description", content: "Define the retirement lifestyle your portfolio must fund each year, in your Target Currency." },
    ],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(spendingQuery),
    context.queryClient.ensureQueryData(dashQuery),
  ]),
  component: SpendingPage,
});

type Row = Awaited<ReturnType<typeof listSpending>>[number];

function SpendingPage() {
  const { data } = useSuspenseQuery(spendingQuery);
  const { data: dash } = useSuspenseQuery(dashQuery);
  const tgtCcy = targetCurrency(dash.profile);
  const grouped = useMemo(() => {
    const core = data.filter((r) => r.rollup === "core");
    const lifestyle = data.filter((r) => r.rollup === "lifestyle");
    const reserve = data.filter((r) => r.rollup === "reserve");
    return { core, lifestyle, reserve };
  }, [data]);

  const coreTotal = grouped.core.reduce((s, r) => s + Number(r.annual_amount), 0);
  const lifestyleTotal = grouped.lifestyle.reduce((s, r) => s + Number(r.annual_amount), 0);
  const reserveTotal = grouped.reserve.reduce((s, r) => s + Number(r.annual_amount), 0);
  const total = coreTotal + lifestyleTotal + reserveTotal;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <>
      <PageHeader
        title="Retirement Lifestyle"
        description="The annual lifestyle your portfolio must fund. This is not an expense tracker — it is the target that every retirement calculation is built on."
        actions={<WorldBadge world="lifestyle" currency={tgtCcy} />}
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Core lifestyle"      value={coreTotal}      pct={pct(coreTotal)}      currency={tgtCcy} />
          <Summary label="Discretionary"       value={lifestyleTotal} pct={pct(lifestyleTotal)} currency={tgtCcy} />
          <Summary label="Long-term reserve"   value={reserveTotal}   pct={pct(reserveTotal)}   currency={tgtCcy} />
          <Summary label="Total annual"        value={total}          currency={tgtCcy} tone="total" hint={`${formatCurrency(total / 12, tgtCcy)} / month`} />
        </div>

        <Section title="Core (essentials)"            description="What the plan must always cover, whatever else happens." rows={grouped.core} />
        <Section title="Lifestyle (discretionary)"    description="The spending that defines the retirement you actually want." rows={grouped.lifestyle} />
        <Section title="Long-term reserve"            description="Sinking funds for vehicles and major household replacements." rows={grouped.reserve} />
      </div>
    </>
  );
}

function Summary({ label, value, pct, currency, tone, hint }: { label: string; value: number; pct?: number; currency: string; tone?: "total"; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums ${tone === "total" ? "text-primary" : ""}`}>
          {formatCurrency(value, currency)}
        </div>
        {pct != null ? (
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">{pct.toFixed(0)}% of total</div>
        ) : hint ? (
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Section({ title, description, rows }: { title: string; description?: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description ?? "Categories in this bucket roll up into your annual retirement lifestyle total."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => <SpendingRow key={r.id} row={r} />)}
      </CardContent>
    </Card>
  );
}

function SpendingRow({ row }: { row: Row }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateSpending);
  const [amount, setAmount] = useState(String(row.annual_amount ?? 0));

  const save = useMutation({
    mutationFn: () => updateFn({ data: { id: row.id, annual_amount: Number(amount) } }),
    onSuccess: () => {
      toast.success(`${row.label} saved`);
      qc.invalidateQueries({ queryKey: ["spending"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-md border px-3 py-2 md:grid-cols-[1fr_140px_auto]">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          {row.label}
          {row.essential ? <Badge variant="outline" className="text-[10px]">essential</Badge> : null}
        </div>
        <div className="text-xs text-muted-foreground">{row.currency} · {row.rollup}</div>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Annual</Label>
        <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
    </div>
  );
}