import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  extractHoldingsFromFile,
  bulkInsertHoldings,
  type ExtractedHoldingT,
} from "@/lib/import.functions";

const ASSET_CLASSES = ["equity", "bond", "cash", "alt", "property"];
const REGIONS = ["uk", "us", "eu", "em", "global"];
const WRAPPERS = ["isa", "sipp", "gia", "pension", "other"];
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,application/pdf,image/*";

type Row = ExtractedHoldingT & { _keep: boolean };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function ImportHoldingsDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [snapshot, setSnapshot] = useState(true);
  const qc = useQueryClient();
  const extractFn = useServerFn(extractHoldingsFromFile);
  const bulkFn = useServerFn(bulkInsertHoldings);

  const reset = () => {
    setFile(null);
    setRows([]);
  };

  const extract = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      if (file.size > 15 * 1024 * 1024) throw new Error("File too large (max 15 MB)");
      const base64 = await fileToBase64(file);
      return extractFn({
        data: { filename: file.name, mimeType: file.type || "", base64 },
      });
    },
    onSuccess: (res) => {
      const parsed = (res.holdings ?? []).map((h) => ({ ...h, _keep: true }));
      setRows(parsed);
      if (parsed.length === 0) {
        toast.warning("No holdings detected. Try a clearer statement or spreadsheet.");
      } else {
        toast.success(`Detected ${parsed.length} holding(s). Review and save.`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const keep = rows.filter((r) => r._keep && r.name && r.value > 0);
      if (keep.length === 0) throw new Error("Nothing to save");
      return bulkFn({
        data: {
          holdings: keep.map(({ _keep: _drop, ...h }) => h),
          createSnapshot: snapshot,
          notes: file ? `Imported from ${file.name}` : undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Saved ${res.inserted} holding(s)${res.snapshot ? " + snapshot" : ""}`);
      qc.invalidateQueries({ queryKey: ["holdings"] });
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const keepCount = rows.filter((r) => r._keep).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-1.5 h-4 w-4" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import holdings</DialogTitle>
          <DialogDescription>
            Upload a broker/pension PDF statement, a screenshot, or an Excel/CSV export. AI extracts positions; you review before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto min-h-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px] space-y-1.5">
              <Label className="text-xs">File</Label>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setRows([]);
                }}
              />
            </div>
            <Button
              onClick={() => extract.mutate()}
              disabled={!file || extract.isPending}
            >
              {extract.isPending ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Extracting…</>
              ) : (
                <><Sparkles className="mr-1.5 h-4 w-4" /> Extract</>
              )}
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="rounded-md border max-h-[55vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Name</TableHead>
                    <TableHead className="w-24">Ticker</TableHead>
                    <TableHead className="w-28">Class</TableHead>
                    <TableHead className="w-28">Region</TableHead>
                    <TableHead className="w-24">Wrapper</TableHead>
                    <TableHead className="w-20">Ccy</TableHead>
                    <TableHead className="w-32 text-right">Value</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r._keep ? "" : "opacity-40"}>
                      <TableCell>
                        <Checkbox
                          checked={r._keep}
                          onCheckedChange={(v) => update(i, { _keep: Boolean(v) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.name}
                          onChange={(e) => update(i, { name: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.ticker ?? ""}
                          onChange={(e) => update(i, { ticker: e.target.value || null })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.asset_class ?? ""}
                          onValueChange={(v) => update(i, { asset_class: v || null })}
                        >
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {ASSET_CLASSES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.region ?? ""}
                          onValueChange={(v) => update(i, { region: v || null })}
                        >
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {REGIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.wrapper ?? ""}
                          onValueChange={(v) => update(i, { wrapper: v || null })}
                        >
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {WRAPPERS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.currency ?? "GBP"}
                          onChange={(e) => update(i, { currency: e.target.value.toUpperCase() })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="text-right tabular-nums"
                          value={r.value}
                          onChange={(e) => update(i, { value: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Totals by currency (selected)</div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
                {Object.entries(
                  rows.filter((r) => r._keep).reduce<Record<string, number>>((acc, r) => {
                    const c = (r.currency || "GBP").toUpperCase();
                    acc[c] = (acc[c] ?? 0) + (Number(r.value) || 0);
                    return acc;
                  }, {}),
                ).sort(([a], [b]) => a.localeCompare(b)).map(([ccy, total]) => (
                  <div key={ccy}>
                    <span className="text-muted-foreground mr-1.5">{ccy}</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("en-GB", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(total)}
                    </span>
                  </div>
                ))}
                {rows.filter((r) => r._keep).length === 0 && (
                  <span className="text-muted-foreground">No rows selected</span>
                )}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="snapshot"
                checked={snapshot}
                onCheckedChange={(v) => setSnapshot(Boolean(v))}
              />
              <Label htmlFor="snapshot" className="text-sm font-normal">
                Create a dated snapshot after saving
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          {rows.length > 0 && (
            <div className="mr-auto text-xs text-muted-foreground">
              {keepCount} of {rows.length} selected
            </div>
          )}
          <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>
            Cancel
          </Button>
          <Button
            disabled={rows.length === 0 || save.isPending || keepCount === 0}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              `Save ${keepCount || ""} holding${keepCount === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}