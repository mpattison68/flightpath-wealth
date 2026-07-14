import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getScenario, runScenario, updateScenario, upsertOverride,
  runStressTest, getSensitivity, generateAiReview, listStressPresets,
} from "@/lib/scenarios.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { OVERRIDE_FIELDS } from "@/lib/scenarios/resolver";
import { SCENARIO_CATEGORIES, categoryLabel } from "@/lib/scenarios/catalog";
import { STRESS_PRESETS } from "@/lib/scenarios/stress-presets";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { WorldBadge } from "@/components/world-badge";
import { ProjectionTable } from "@/components/scenarios/projection-table";
import { WealthChart, IncomeChart, PurchasingPowerChart } from "@/components/scenarios/projection-charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Play, Sparkles, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { investmentCurrency, targetCurrency } from "@/lib/currency";
import type { ProjectionOutput, SensitivityDriver } from "@/lib/finance/projection";

const scenarioQuery = (id: string) => queryOptions({ queryKey: ["scenario", id], queryFn: () => getScenario({ data: { id } }) });
const dashQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboardData() });

export const Route = createFileRoute("/_authenticated/scenarios/$scenarioId")({
  head: () => ({ meta: [{ title: "Scenario — Wealth Flightpath" }] }),
  loader: ({ context, params }) => Promise.all([
    context.queryClient.ensureQueryData(scenarioQuery(params.scenarioId)),
    context.queryClient.ensureQueryData(dashQuery),
  ]),
  component: ScenarioDashboard,
});

function ScenarioDashboard() {
  const { scenarioId } = Route.useParams();
  const { data } = useSuspenseQuery(scenarioQuery(scenarioId));
  const { data: dash } = useSuspenseQuery(dashQuery);
  const qc = useQueryClient();
  const invCcy = investmentCurrency(dash.profile);
  const tgtCcy = targetCurrency(dash.profile);

  const runFn = useServerFn(runScenario);
  const runMut = useMutation({
    mutationFn: () => runFn({ data: { id: scenarioId } }),
    onSuccess: () => { toast.success("Projection ready"); qc.invalidateQueries({ queryKey: ["scenario", scenarioId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-run on first visit if no projection yet.
  useEffect(() => {
    if (!data.scenario.projection && !runMut.isPending) runMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projection = (data.scenario.projection as unknown as ProjectionOutput | null) ?? null;

  return (
    <>
      <PageHeader
        title={data.scenario.name}
        description={data.scenario.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/scenarios"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Library</Button></Link>
            <WorldBadge world="wealth" currency={invCcy} />
            <span className="text-xs text-muted-foreground">→</span>
            <WorldBadge world="lifestyle" currency={tgtCcy} />
            <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
              <Play className="mr-2 h-4 w-4" />{runMut.isPending ? "Running…" : "Run projection"}
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="projection">Projection</TabsTrigger>
            <TabsTrigger value="stress">Stress Tests</TabsTrigger>
            <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab scenario={data.scenario} projection={projection} invCcy={invCcy} tgtCcy={tgtCcy} scenarioId={scenarioId} />
          </TabsContent>
          <TabsContent value="builder" className="space-y-4">
            <BuilderTab scenarioId={scenarioId} scenario={data.scenario} overrides={data.overrides} onSaved={() => runMut.mutate()} />
          </TabsContent>
          <TabsContent value="projection" className="space-y-4">
            <ProjectionTab projection={projection} invCcy={invCcy} tgtCcy={tgtCcy} />
          </TabsContent>
          <TabsContent value="stress" className="space-y-4">
            <StressTab scenarioId={scenarioId} stress={data.stressTests} baseline={projection} tgtCcy={tgtCcy} invCcy={invCcy} />
          </TabsContent>
          <TabsContent value="sensitivity" className="space-y-4">
            <SensitivityTab scenarioId={scenarioId} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// --------- Overview -------------------------------------------------------

function OverviewTab({ scenario, projection, invCcy, tgtCcy, scenarioId }: {
  scenario: { id: string; name: string; scenario_type: string; status: string; probability: number | null; notes: string | null; ai_summary: string | null };
  projection: ProjectionOutput | null; invCcy: string; tgtCcy: string; scenarioId: string;
}) {
  const qc = useQueryClient();
  const aiFn = useServerFn(generateAiReview);
  const aiMut = useMutation({
    mutationFn: () => aiFn({ data: { scenario_id: scenarioId } }),
    onSuccess: () => { toast.success("AI review updated"); qc.invalidateQueries({ queryKey: ["scenario", scenarioId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!projection) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Run the projection to see results.</CardContent></Card>;
  const s = projection.summary;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Success probability" value={`${s.successProbability}/100`} tone={s.successProbability >= 70 ? "positive" : s.successProbability >= 40 ? "neutral" : "warning"} hint={`${categoryLabel(scenario.scenario_type)}`} />
        <KpiCard label="Retirement" value={`${s.retirementAge} · ${s.retirementYear}`} hint={s.depleted ? `Depleted at ${s.depletedAtAge}` : "Portfolio survives horizon"} tone={s.depleted ? "warning" : "positive"} />
        <KpiCard label="Lowest purchasing power" value={`${s.lowestPurchasingPower.toFixed(2)}×`} tone={s.lowestPurchasingPower >= 1 ? "positive" : "warning"} hint={`In ${tgtCcy}`} />
        <KpiCard label="Final legacy" value={formatCurrency(s.finalLegacyTgt, tgtCcy)} hint={`Peak wealth ${formatCurrency(s.peakWealth, invCcy)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Max drawdown" value={formatPercent(s.maxDrawdownPct)} tone={s.maxDrawdownPct > 30 ? "warning" : "neutral"} />
        <KpiCard label="Years under pressure" value={String(s.yearsUnderPressure)} tone={s.yearsUnderPressure > 5 ? "warning" : "neutral"} />
        <KpiCard label="Years portfolio lasts" value={String(s.yearsPortfolioLasts)} />
        <KpiCard label="Avg retirement spend" value={formatCurrency(s.averageSpendingTgt, tgtCcy)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Strategy Review</CardTitle>
              <CardDescription>Explained in {tgtCcy} purchasing power terms.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => aiMut.mutate()} disabled={aiMut.isPending}>
              {scenario.ai_summary ? "Regenerate" : "Generate"}
            </Button>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
            {scenario.ai_summary ?? <span className="text-muted-foreground">No AI review yet. Click Generate.</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Key risks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <RiskRow ok={!s.depleted} label="Portfolio survives to planning horizon" />
            <RiskRow ok={s.lowestPurchasingPower >= 1} label="Purchasing power stays ≥ 1× at retirement" />
            <RiskRow ok={s.yearsUnderPressure <= 3} label="Fewer than 3 years under pressure" />
            <RiskRow ok={s.maxDrawdownPct < 30} label="Max drawdown under 30%" />
            <RiskRow ok={s.finalLegacyTgt > 0} label="Positive legacy at end of horizon" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RiskRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <span>{label}</span>
      {ok ? <Badge className="bg-status-positive text-status-positive-foreground hover:bg-status-positive"><TrendingUp className="mr-1 h-3 w-3" />OK</Badge>
        : <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Risk</Badge>}
    </div>
  );
}

// --------- Builder --------------------------------------------------------

function BuilderTab({ scenarioId, scenario, overrides, onSaved }: {
  scenarioId: string;
  scenario: { id: string; name: string; description: string | null; scenario_type: string; subtype: string | null; probability: number | null; status: string; notes: string | null };
  overrides: { assumption_key: string; value_numeric: number | null }[];
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertOverride);
  const updateFn = useServerFn(updateScenario);
  const overrideMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of overrides) if (o.value_numeric != null) m.set(o.assumption_key, Number(o.value_numeric));
    return m;
  }, [overrides]);
  const [meta, setMeta] = useState({
    name: scenario.name, description: scenario.description ?? "", status: scenario.status,
    probability: scenario.probability ?? 50, notes: scenario.notes ?? "",
  });

  const saveMeta = useMutation({
    mutationFn: () => updateFn({ data: {
      id: scenarioId,
      name: meta.name, description: meta.description || null,
      status: meta.status as "draft" | "active" | "archived",
      probability: Number(meta.probability),
      notes: meta.notes || null,
    }}),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["scenario", scenarioId] }); qc.invalidateQueries({ queryKey: ["scenarios"] }); },
  });

  const overrideMut = useMutation({
    mutationFn: (v: { key: string; value: number | null }) => upsertFn({ data: {
      scenario_id: scenarioId, assumption_key: v.key, value_numeric: v.value,
    }}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scenario", scenarioId] }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Scenario details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={meta.status} onValueChange={(v) => setMeta({ ...meta, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Description</Label><Textarea rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Probability ({Number(meta.probability).toFixed(0)}%)</Label><Input type="range" min={0} max={100} value={meta.probability} onChange={(e) => setMeta({ ...meta, probability: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea rows={2} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}>Save details</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overrides</CardTitle>
          <CardDescription>Blank inherits baseline. Only overridden values are stored per scenario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {OVERRIDE_FIELDS.map((group) => (
            <div key={group.group} className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.group}</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((f) => (
                  <OverrideInput key={f.key}
                    field={f}
                    value={overrideMap.get(f.key) ?? null}
                    onCommit={(value) => overrideMut.mutate({ key: f.key, value })}
                  />
                ))}
              </div>
              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function OverrideInput({ field, value, onCommit }: {
  field: { key: string; label: string; unit: string; hint?: string };
  value: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [local, setLocal] = useState<string>(value == null ? "" : String(value));
  useEffect(() => { setLocal(value == null ? "" : String(value)); }, [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{field.label} {field.unit ? <span className="text-muted-foreground">({field.unit})</span> : null}</Label>
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const trimmed = local.trim();
          const next = trimmed === "" ? null : Number(trimmed);
          if (next != null && !Number.isFinite(next)) return;
          if ((next ?? null) === (value ?? null)) return;
          onCommit(next);
        }}
        placeholder="Inherit"
      />
      {field.hint ? <div className="text-[10px] text-muted-foreground">{field.hint}</div> : null}
    </div>
  );
}

// --------- Projection tab -------------------------------------------------

function ProjectionTab({ projection, invCcy, tgtCcy }: { projection: ProjectionOutput | null; invCcy: string; tgtCcy: string }) {
  if (!projection) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Run the projection first.</CardContent></Card>;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Wealth over time ({invCcy})</CardTitle></CardHeader>
          <CardContent className="h-72"><WealthChart projection={projection} invCcy={invCcy} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Retirement income vs spending ({tgtCcy})</CardTitle></CardHeader>
          <CardContent className="h-72"><IncomeChart projection={projection} tgtCcy={tgtCcy} /></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchasing power over time</CardTitle>
          <CardDescription>1× = today's lifestyle fully funded in {tgtCcy}.</CardDescription>
        </CardHeader>
        <CardContent className="h-64"><PurchasingPowerChart projection={projection} /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Annual projection</CardTitle></CardHeader>
        <CardContent><ProjectionTable projection={projection} invCcy={invCcy} tgtCcy={tgtCcy} /></CardContent>
      </Card>
    </>
  );
}

// --------- Stress tab -----------------------------------------------------

function StressTab({ scenarioId, stress, baseline, tgtCcy, invCcy }: {
  scenarioId: string;
  stress: { id: string; preset_key: string; label: string; result: unknown }[];
  baseline: ProjectionOutput | null;
  tgtCcy: string; invCcy: string;
}) {
  const qc = useQueryClient();
  const runFn = useServerFn(runStressTest);
  const runMut = useMutation({
    mutationFn: (preset_key: string) => runFn({ data: { scenario_id: scenarioId, preset_key } }),
    onSuccess: () => { toast.success("Stress test run"); qc.invalidateQueries({ queryKey: ["scenario", scenarioId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Run a stress test</CardTitle>
          <CardDescription>Applies an ephemeral shock on top of this scenario and re-runs the projection.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STRESS_PRESETS.map((p) => (
            <button
              key={p.key}
              className="rounded-md border bg-card p-3 text-left transition hover:border-primary"
              onClick={() => runMut.mutate(p.key)}
              disabled={runMut.isPending}
            >
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-[11px] text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {stress.length > 0 ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Results</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stress.map((s) => {
              const r = s.result as ProjectionOutput | null;
              const summary = r?.summary;
              const delta = baseline && summary
                ? summary.lowestPurchasingPower - baseline.summary.lowestPurchasingPower
                : null;
              return (
                <div key={s.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">Preset: {s.preset_key}</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground">Success</div>
                    <div className="tabular-nums font-medium">{summary?.successProbability ?? "—"}/100</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground">Lowest RPPI</div>
                    <div className="tabular-nums font-medium">{summary?.lowestPurchasingPower.toFixed(2) ?? "—"}×</div>
                  </div>
                  <div className="text-xs">
                    <div className="text-muted-foreground">vs Baseline</div>
                    <div className={"tabular-nums font-medium " + (delta != null && delta < 0 ? "text-status-warning" : "text-status-positive")}>
                      {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}×`}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-[11px] text-muted-foreground">
              Delta compares lowest retirement-year purchasing power (in {tgtCcy}) to the base scenario. Wealth remains in {invCcy}.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

// --------- Sensitivity ---------------------------------------------------

function SensitivityTab({ scenarioId }: { scenarioId: string }) {
  const senFn = useServerFn(getSensitivity);
  const [drivers, setDrivers] = useState<SensitivityDriver[] | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Sensitivity analysis</CardTitle>
          <CardDescription>Which assumptions move final purchasing power most (±10% perturbation).</CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={pending} onClick={async () => {
          setPending(true);
          try { setDrivers(await senFn({ data: { scenario_id: scenarioId } })); }
          catch (e) { toast.error((e as Error).message); }
          finally { setPending(false); }
        }}>{pending ? "Computing…" : drivers ? "Recompute" : "Compute"}</Button>
      </CardHeader>
      <CardContent>
        {!drivers ? (
          <div className="text-sm text-muted-foreground">Click Compute to rank the drivers of this scenario's outcome.</div>
        ) : (
          <div className="space-y-2">
            {drivers.map((d, i) => (
              <div key={String(d.key)} className="rounded-md border p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{i + 1}. {d.label}</div>
                  <div className="tabular-nums">{d.impactPct.toFixed(2)}× swing</div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                  <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />{d.downValue.toFixed(2)} → RPPI {d.downPurchasingPower.toFixed(2)}×</span>
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{d.upValue.toFixed(2)} → RPPI {d.upPurchasingPower.toFixed(2)}×</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, d.impactPct * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}