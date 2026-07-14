import { createFileRoute } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/scenarios")({
  head: () => ({ meta: [{ title: "Scenarios — Wealth Flightpath" }] }),
  component: () => <Outlet />,
});