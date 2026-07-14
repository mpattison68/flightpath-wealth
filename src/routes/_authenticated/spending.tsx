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
import { formatCurrency } from "@/lib/format";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const spendingQuery = queryOptions({ queryKey: ["spending"], queryFn: () => listSpending() });
const dashQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardData() });

export const Route = createFileRoute("/_authenticated/spending")({
  head: () => ({
    meta: [
      { title: "Spending — Wealth Flightpath" },
      { name: "description", content: "Break down what life actually costs each year, from essentials to lifestyle." },
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
    return { core, lifestyle };
  }, [data]);

  const coreTotal = grouped.core.reduce((s, r) => s + Number(r.annual_amount), 0);
  const lifestyleTotal = grouped.lifestyle.reduce((s, r) => s + Number(r.annual_amount), 0);
  const total = coreTotal + lifestyleTotal;

  return (
    <>
      <PageHeader title="Spending" description={`What life actually costs each year in your target currency (${tgtCcy}) — the input that drives your FIRE target.`} />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Summary label="Core spending" value={coreTotal} currency={tgtCcy} tone="core" />
          <Summary label="Lifestyle spending" value={lifestyleTotal} currency={tgtCcy} tone="lifestyle" />
          <Summary label="Total annual spending" value={total} currency={tgtCcy} tone="total" />
        </div>

        <Section title="Core (essentials)" rows={grouped.core} />
        <Section title="Lifestyle (discretionary)" rows={grouped.lifestyle} />
      </div>
    </>
  );
}

function Summary({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: "core" | "lifestyle" | "total" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums ${tone === "total" ? "text-primary" : ""}`}>
          {formatCurrency(value, currency)}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Categories in this bucket roll up into your annual spending total.</CardDescription>
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