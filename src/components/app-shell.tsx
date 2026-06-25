import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { VISIBLE_MODULES } from "@/modules/registry";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plane className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Wealth Flightpath</div>
            <div className="text-[11px] text-muted-foreground">Retirement command centre</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {VISIBLE_MODULES.map((m) => {
            const active = location.pathname === m.path || location.pathname.startsWith(m.path + "/");
            const Icon = m.icon;
            return (
              <Link
                key={m.id}
                to={m.path}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}