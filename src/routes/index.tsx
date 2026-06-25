import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plane, Compass, LineChart, MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wealth Flightpath AI — Your retirement command centre" },
      { name: "description", content: "An AI-powered retirement and wealth platform. Monitor your portfolio, model scenarios and stay on course for retirement." },
      { property: "og:title", content: "Wealth Flightpath AI" },
      { property: "og:description", content: "An AI-powered retirement command centre. Where am I? Am I on course? What should I do next?" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Plane className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Wealth Flightpath</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Retirement command centre</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Stay on course for the retirement you're planning.
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            Wealth Flightpath AI continuously answers four questions: where you are, where you're heading,
            whether you're still on course, and what to do next. Calm, premium, AI-augmented — not another portfolio tracker.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Start your flightpath</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/dashboard">See the dashboard</Link></Button>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Compass, title: "Flightpath", body: "A single timeline from today to retirement, showing whether you're tracking ahead, on plan or behind." },
            { icon: LineChart, title: "Portfolio", body: "Holdings, allocation drift, currency and platform exposure — explained in plain English." },
            { icon: MessageSquare, title: "AI Coach", body: "Ask anything about your plan. The AI explains; the app always owns the numbers." },
            { icon: ShieldCheck, title: "Your data", body: "Self-hosted on your own infrastructure. Encrypted, private, yours." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
