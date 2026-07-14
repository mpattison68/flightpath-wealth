import { cn } from "@/lib/utils";

// Two Worlds visual language.
//
// Every screen that displays financial numbers should carry a subtle
// signal of which "world" those numbers belong to:
//
// - Wealth World (blue) — Investment Currency. Portfolio, holdings,
//   allocation, historical performance, property values.
// - Lifestyle World (green) — Target Currency. Retirement spending,
//   FIRE target, sustainable income, purchasing power, readiness.
//
// The badge is deliberately low-noise: a coloured dot + the ISO code +
// the world label. Never use it for status or general accent colour.

export type World = "wealth" | "lifestyle";

export function WorldBadge({
  world,
  currency,
  className,
}: {
  world: World;
  currency: string;
  className?: string;
}) {
  const isWealth = world === "wealth";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        isWealth
          ? "border-world-wealth/30 bg-world-wealth-soft text-world-wealth"
          : "border-world-lifestyle/30 bg-world-lifestyle-soft text-world-lifestyle",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isWealth ? "bg-world-wealth" : "bg-world-lifestyle",
        )}
      />
      <span className="tabular-nums">{currency}</span>
      <span className="opacity-70">{isWealth ? "Investment" : "Target"}</span>
    </span>
  );
}

export function WorldRail({ world }: { world: World }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-y-0 left-0 w-[3px] rounded-l-md",
        world === "wealth" ? "bg-world-wealth/70" : "bg-world-lifestyle/70",
      )}
    />
  );
}