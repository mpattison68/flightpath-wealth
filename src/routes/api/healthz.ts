import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/healthz")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
          headers: { "content-type": "application/json" },
        }),
    },
  },
});