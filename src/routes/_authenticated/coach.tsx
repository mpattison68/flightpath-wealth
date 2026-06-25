import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "AI Coach — Wealth Flightpath" }] }),
  component: CoachPage,
});

function CoachPage() {
  return (
    <>
      <PageHeader title="AI Coach" description="Ask anything about your plan. The AI explains; the app owns the numbers." />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-primary" /> Coming in Phase 3</CardTitle>
            <CardDescription>A threaded chat with full context of your portfolio, plan and snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Example questions you'll be able to ask: <em>How exposed am I to US equities? How dependent am I on UK property? What happens if inflation averages 5%? How has my retirement readiness changed since last quarter?</em>
          </CardContent>
        </Card>
      </div>
    </>
  );
}