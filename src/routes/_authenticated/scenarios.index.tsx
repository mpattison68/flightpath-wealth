import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listScenarios, createScenario, setBaseline, deleteScenario, duplicateScenario } from "@/lib/scenarios.functions";
import { SCENARIO_CATEGORIES, categoryLabel } from "@/lib/scenarios/catalog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { FlaskConical, Plus, MoreHorizontal, Star, Copy, Trash2, GitCompare } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const scenariosQuery = queryOptions({ queryKey: ["scenarios"], queryFn: () => listScenarios() });

export const Route = createFileRoute("/_authenticated/scenarios/")({
  head: () => ({ meta: [{ title: "Scenario Library — Wealth Flightpath" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(scenariosQuery),
  component: LibraryPage,
});

function LibraryPage() {
  const { data: scenarios } = useSuspenseQuery(scenariosQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const setBaselineFn = useServerFn(setBaseline);
  const deleteFn = useServerFn(deleteScenario);
  const dupFn = useServerFn(duplicateScenario);

  const baselineMut = useMutation({
    mutationFn: (id: string) => setBaselineFn({ data: { id } }),
    onSuccess: () => { toast.success("Baseline updated"); qc.invalidateQueries({ queryKey: ["scenarios"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["scenarios"] }); },
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => { toast.success("Duplicated"); qc.invalidateQueries({ queryKey: ["scenarios"] }); },
  });

  const filtered = filter === "all" ? scenarios : scenarios.filter((s) => s.scenario_type === filter);

  function toggleSelect(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s);
  }

  return (
    <>
      <PageHeader
        title="Scenario Library"
        description="Explore alternative retirement futures. Each scenario inherits your baseline assumptions — you only store what you change."
        actions={
          <div className="flex items-center gap-2">
            {selected.length >= 2 ? (
              <Button variant="outline" onClick={() => navigate({ to: "/scenarios/compare", search: { ids: selected.join(",") } })}>
                <GitCompare className="mr-2 h-4 w-4" />Compare ({selected.length})
              </Button>
            ) : null}
            <NewScenarioDialog open={open} onOpenChange={setOpen} />
          </div>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Filter</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {SCENARIO_CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">Select 2–4 scenarios to compare side-by-side.</div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" /> No scenarios yet</CardTitle>
              <CardDescription>Create your first scenario from a template — or start with a blank canvas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New scenario</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Card key={s.id} className={selected.includes(s.id) ? "ring-2 ring-primary" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {s.is_baseline ? <Star className="h-3.5 w-3.5 fill-status-positive text-status-positive" /> : null}
                        <Link to="/scenarios/$scenarioId" params={{ scenarioId: s.id }} className="truncate text-sm font-medium hover:underline">
                          {s.name}
                        </Link>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{categoryLabel(s.scenario_type)}</Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
                        {s.probability != null ? <Badge variant="outline" className="text-[10px]">{Number(s.probability).toFixed(0)}%</Badge> : null}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => baselineMut.mutate(s.id)}><Star className="mr-2 h-4 w-4" />Set as baseline</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => dupMut.mutate(s.id)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {s.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p> : null}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Last run {s.last_run_at ? new Date(s.last_run_at).toLocaleDateString() : "—"}</span>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => toggleSelect(s.id)}
                    >{selected.includes(s.id) ? "Selected" : "Select"}</button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NewScenarioDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createScenario);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<string>("retirement_timing");
  const [subtype, setSubtype] = useState<string>("");
  const [prob, setProb] = useState<number>(50);

  const category = SCENARIO_CATEGORIES.find((c) => c.key === type);

  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      name: name.trim() || "Untitled scenario",
      description: desc || null,
      scenario_type: type,
      subtype: subtype || null,
      probability: prob,
    }}),
    onSuccess: (row) => {
      toast.success("Scenario created");
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      onOpenChange(false);
      navigate({ to: "/scenarios/$scenarioId", params: { scenarioId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />New scenario</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New scenario</DialogTitle>
          <DialogDescription>Start from a template or a blank canvas. You can override any assumption later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Retire 2027" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Pull retirement forward, keep property until 2030." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setSubtype(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCENARIO_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={subtype} onValueChange={setSubtype}>
                <SelectTrigger><SelectValue placeholder="Blank" /></SelectTrigger>
                <SelectContent>
                  {category?.subtypes.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subjective probability ({prob}%)</Label>
            <Input type="range" min={0} max={100} value={prob} onChange={(e) => setProb(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}