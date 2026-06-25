import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative" | "warning";

const toneClass: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-status-positive",
  negative: "text-status-negative",
  warning: "text-status-warning",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </div>
            {hint ? (
              <div className={cn("mt-1 text-xs tabular-nums", toneClass[tone])}>{hint}</div>
            ) : null}
          </div>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}