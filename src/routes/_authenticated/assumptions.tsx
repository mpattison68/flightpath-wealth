import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAssumptions,
  upsertAssumption,
  markAssumptionReviewed,
} from "@/lib/assumptions.functions";
import { PageHeader } from "@/components/page-header";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const assumptionsQuery = queryOptions({
  queryKey: ["assumptions"],
  queryFn: () => listAssumptions(),
});

export const Route = createFileRoute("/_authenticated/assumptions")({
  head: () => ({
    meta: [
      { title: "Planning Assumptions — Wealth Flightpath" },
      { name: "description", content: "The numbers behind every projection." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(assumptionsQuery),
  component: AssumptionsPage,
});

type Row = Awaited<ReturnType<typeof listAssumptions>>[number];

function AssumptionsPage() {
  const { data } = useSuspenseQuery(assumptionsQuery);
  const grouped = useMemo(() => {
    const g = new Map<string, Row[]>();
    for (const r of data) {
      const list = g.get(r.category) ?? [];
      list.push(r);
      g.set(r.category, list);
    }
    return [...g.entries()];
  }, [data]);

  return (
    <>
      <PageHeader
        title="Planning Assumptions"
        description="The values used to model your future. Change these to reshape every projection."
      />
      <div className="p-6">
        <Accordion type="multiple" defaultValue={grouped.map(([c]) => c)} className="space-y-3">
          {grouped.map(([category, rows]) => (
            <AccordionItem key={category} value={category} className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-3">
                  <span>{category}</span>
                  <span className="text-xs text-muted-foreground">{rows.length} items</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid gap-3">
                  {rows.map((r) => <AssumptionRow key={r.key} row={r} />)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  );
}

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  low: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

function AssumptionRow({ row }: { row: Row }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertAssumption);
  const reviewFn = useServerFn(markAssumptionReviewed);
  const [value, setValue] = useState<string>(row.value_numeric?.toString() ?? "");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">(
    row.confidence as "high" | "medium" | "low",
  );
  const [source, setSource] = useState(row.source ?? "");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      key: row.key, category: row.category, label: row.label, unit: row.unit,
      value_numeric: value === "" ? null : Number(value),
      confidence, source: source || null,
      description: row.description, note: note || null,
    } }),
    onSuccess: () => {
      toast.success(`${row.label} saved`);
      setNote("");
      qc.invalidateQueries({ queryKey: ["assumptions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const review = useMutation({
    mutationFn: () => reviewFn({ data: { key: row.key } }),
    onSuccess: () => { toast.success("Marked reviewed"); qc.invalidateQueries({ queryKey: ["assumptions"] }); },
  });

  const lastReviewed = row.last_reviewed_at
    ? new Date(row.last_reviewed_at).toLocaleDateString()
    : "Never";

  return (
    <Card className="border-muted">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.label}</span>
              <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_TONE[row.confidence]}`}>
                {row.confidence}
              </Badge>
              {row.isSeeded && <Badge variant="outline" className="text-[10px]">default</Badge>}
            </div>
            <span className="text-xs text-muted-foreground">{row.description}</span>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="tabular-nums text-sm font-medium">
                {row.value_numeric ?? "—"}{row.unit ? ` ${row.unit}` : ""}
              </div>
              <div className="text-[10px] text-muted-foreground">Reviewed {lastReviewed}</div>
            </div>
          </div>
        </button>
        {open && (
          <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Value{row.unit ? ` (${row.unit})` : ""}</Label>
              <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confidence</Label>
              <Select value={confidence} onValueChange={(v: "high" | "medium" | "low") => setConfidence(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Source</Label>
              <Input placeholder="e.g. ONS, HL forecast, personal estimate" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-4">
              <Label className="text-xs">Change note (optional)</Label>
              <Textarea rows={2} placeholder="Why are you changing this?" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => review.mutate()} disabled={review.isPending}>
                Mark reviewed
              </Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}