import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions, useMutation } from "@tanstack/react-query";
import { listHoldings, upsertHolding, deleteHolding, createSnapshot, listSnapshots } from "@/lib/portfolio.functions";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Camera } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { sumValue, allocation, type Holding } from "@/lib/finance/calculators";

const holdingsQuery = queryOptions({ queryKey: ["holdings"], queryFn: () => listHoldings() });
const snapshotsQuery = queryOptions({ queryKey: ["snapshots"], queryFn: () => listSnapshots() });

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — Wealth Flightpath" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(holdingsQuery),
    context.queryClient.ensureQueryData(snapshotsQuery),
  ]),
  component: PortfolioPage,
});

const ASSET_CLASSES = ["equity", "bond", "cash", "alt", "property"];
const REGIONS = ["uk", "us", "eu", "em", "global"];
const WRAPPERS = ["isa", "sipp", "gia", "pension", "other"];

function PortfolioPage() {
  const { data: holdings } = useSuspenseQuery(holdingsQuery);
  const { data: snapshots } = useSuspenseQuery(snapshotsQuery);
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertHolding);
  const deleteFn = useServerFn(deleteHolding);
  const snapFn = useServerFn(createSnapshot);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", ticker: "", asset_class: "equity", region: "global",
    currency: "GBP", value: 0, wrapper: "isa", liquidity: "liquid",
  });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { ...form, value: Number(form.value) } }),
    onSuccess: () => {
      toast.success("Holding saved");
      setOpen(false);
      setForm({ name: "", ticker: "", asset_class: "equity", region: "global", currency: "GBP", value: 0, wrapper: "isa", liquidity: "liquid" });
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Holding removed");
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const snap = useMutation({
    mutationFn: () => snapFn({ data: {} }),
    onSuccess: () => {
      toast.success("Snapshot created");
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = sumValue(holdings as Holding[]);
  const byRegion = allocation(holdings as Holding[], "region");

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Your holdings, allocation and platform exposure."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={snap.isPending || holdings.length === 0} onClick={() => snap.mutate()}>
              <Camera className="mr-1.5 h-4 w-4" /> Snapshot
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add holding</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add holding</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ticker"><Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} /></Field>
                    <Field label="Value (GBP)"><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Asset class">
                      <Select value={form.asset_class} onValueChange={(v) => setForm({ ...form, asset_class: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ASSET_CLASSES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Region">
                      <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{REGIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Wrapper">
                      <Select value={form.wrapper} onValueChange={(v) => setForm({ ...form, wrapper: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{WRAPPERS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Liquidity">
                      <Select value={form.liquidity} onValueChange={(v) => setForm({ ...form, liquidity: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="liquid">liquid</SelectItem>
                          <SelectItem value="illiquid">illiquid</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || form.value <= 0}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wide text-muted-foreground">Total value</div><div className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(total)}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wide text-muted-foreground">Holdings</div><div className="mt-2 text-2xl font-semibold tabular-nums">{holdings.length}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wide text-muted-foreground">Snapshots</div><div className="mt-2 text-2xl font-semibold tabular-nums">{snapshots.length}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Holdings</CardTitle>
            <CardDescription>Every position counted toward your retirement.</CardDescription>
          </CardHeader>
          <CardContent>
            {holdings.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No holdings yet. Add your first to begin.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Wrapper</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="text-muted-foreground">{h.ticker ?? "—"}</TableCell>
                      <TableCell>{h.asset_class ?? "—"}</TableCell>
                      <TableCell>{h.region ?? "—"}</TableCell>
                      <TableCell>{h.wrapper ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(h.value), h.currency ?? "GBP")}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => remove.mutate(h.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {byRegion.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocation by region</CardTitle>
              <CardDescription>Where in the world is your money?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {byRegion.map((row) => (
                  <div key={row.name} className="flex items-center gap-3">
                    <div className="w-20 text-xs uppercase text-muted-foreground">{row.name}</div>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
                    </div>
                    <div className="w-20 text-right text-xs tabular-nums">{row.pct.toFixed(1)}%</div>
                    <div className="w-28 text-right text-xs tabular-nums text-muted-foreground">{formatCurrency(row.value)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}