import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/scenarios")({
  head: () => ({ meta: [{ title: "Scenarios — Wealth Flightpath" }] }),
  component: ScenariosPage,
});

function ScenariosPage() {
  return (
    <>
      <PageHeader title="Scenarios" description="What if you made a different decision?" />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" /> Coming in Phase 3</CardTitle>
            <CardDescription>Named scenarios with deterministic projections and AI commentary.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>You'll be able to model:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Retire 2027 / 2030 / 2033</li>
              <li>Higher inflation</li>
              <li>Market crash</li>
              <li>Sell property early</li>
              <li>Consulting income in early retirement</li>
            </ul>
            <p className="mt-3">Each scenario keeps its own assumptions and can be compared side by side.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}