
# Wealth Flightpath AI — Production Platform Plan (v2)

This supersedes the previous plan. Architecture is now designed for a long-lived, self-hosted retirement command centre.

## 1. Deployment architecture (self-hosted on Hostinger VPS)

The current template targets Cloudflare Workers SSR. I'll reconfigure it to build for a **standard Node.js server**:

- Switch TanStack Start build target from `cloudflare-module` to `node-server` in `vite.config.ts`
- Produce a standalone Node bundle in `.output/` (TanStack Start native output)
- Add a thin `server.js` entry that respects `PORT` and `HOST` env vars
- **Dockerfile** — multi-stage: `node:20-alpine` builder → slim runtime, non-root user, healthcheck on `/healthz`
- **docker-compose.yml** — single `web` service, env file, restart policy, exposed port via `${APP_PORT}` (default 3000), labelled for Portainer
- **.env.example** — all required vars documented (see §13)
- **No SSL inside the app** — Nginx Proxy Manager terminates TLS, forwards plain HTTP to the container
- **GitHub Actions** — `.github/workflows/deploy.yml` builds the Docker image, pushes to GHCR, and SSHes into the VPS to `docker compose pull && up -d`
- **`/healthz`** server route for NPM health checks

Supabase remains the database/auth/storage backend (managed Supabase, not self-hosted — confirm in §13 decision 1).

## 2. Modular architecture

Source layout:

```text
src/
  modules/
    dashboard/        # visible v1
    portfolio/        # visible v1
    retirement/       # visible v1
    scenarios/        # visible v1
    coach/            # visible v1
    property/         # placeholder
    pensions/         # placeholder (income sources lives here)
    estate/           # placeholder
    tax/              # placeholder
    insurance/        # placeholder
    documents/        # placeholder (statement upload lives in portfolio for v1)
    settings/         # visible v1
  lib/
    finance/          # deterministic calculators (FIRE, SWR, longevity, drift)
    ai/               # gateway client, prompt templates, extraction schemas
    supabase/         # client + server clients
  routes/             # TanStack route files import from modules/
  components/ui/      # shadcn
  components/         # shared app components (KpiCard, ChartShell, SectionHeader)
```

Each module owns its routes, components, server functions, and types. Nav-level registry decides which modules are visible vs "coming soon".

## 3. Database schema (Supabase, full v1+ surface)

Created up front so future modules drop in cleanly. All tables RLS-scoped to `auth.uid()` with explicit GRANTs, `user_roles` pattern for admin.

| Table | Purpose |
|---|---|
| `profiles` | display name, base currency (default GBP), locale |
| `user_roles` | admin / user enum, separate table per security rules |
| `platforms` | user's investment platforms (HL, Vanguard, etc.) |
| `holdings` | full spec: platform, provider, fund, ticker, asset_class, region, currency, value, units, price, wrapper, liquidity, role, notes |
| `valuation_snapshots` | header row per snapshot (date, source: manual/upload, total_value, fx_rates jsonb) |
| `snapshot_holdings` | line items frozen at snapshot time |
| `portfolio_documents` | uploaded statements (storage path, mime, parsed_json, status) |
| `retirement_plans` | one active plan per user + named historical versions |
| `income_sources` | state pensions, DB pensions, annuities, rental, consulting — with start_date, annual_value, inflation_behaviour, tax_status, currency |
| `property_assets` | value, purchase_price, sale_date, rental_income, expenses, mortgage, role |
| `scenarios` | named scenarios with assumptions JSON |
| `scenario_results` | cached deterministic projections per scenario |
| `documents` | unified document library (type enum, storage path, ai_embedding ref) |
| `ai_conversations` + `ai_messages` | coach chat history (threaded) |
| `ai_reviews` | generated quarterly reviews |
| `settings` | per-user assumptions, tolerances, notification prefs |
| `fx_rates` | base GBP rate cache |

Storage buckets: `portfolio-documents` (private), `library-documents` (private).

## 4. Statement upload pipeline (v1)

1. User uploads PDF/XLSX/CSV → stored in `portfolio-documents`
2. Server function: detect type → extract text (pdf-parse for PDF, xlsx for sheets, csv-parse for CSV)
3. Send extracted text + system prompt to AI Gateway → returns structured JSON (Zod-validated)
4. Auto-classify asset class / region / fund type / growth-vs-defensive
5. Match against existing holdings (ticker → name fuzzy → ask user)
6. **Review screen**: side-by-side diff of current vs proposed holdings, every field editable
7. On confirm: insert/update holdings, write `valuation_snapshots` + `snapshot_holdings`, mark document as processed
8. Never auto-overwrite

## 5. AI design (strict separation)

- Deterministic calculators in `src/lib/finance/` (pure TS, unit-tested) own **every number**
- AI calls receive **pre-computed metrics as JSON context**, never raw holdings to "calculate"
- AI Gateway via `@ai-sdk/openai-compatible` (default `google/gemini-3-flash-preview`; `openai/gpt-5` available — see §13 decision 2)
- Roles:
  - **Statement Extractor** — structured output via Zod schema
  - **Portfolio Assistant** (chat) — context-augmented Q&A
  - **Quarterly Reviewer** — generates `ai_reviews`
  - **Scenario Commentator** — narrates simulator output
  - **Document Q&A** — RAG over document library (Phase 4)

## 6. Retirement Flightpath (centrepiece)

Hero visualisation: timeline from today → retirement date → life expectancy, with a single "glidepath line" of projected sustainable income. Surrounding cards: Years Remaining · FIRE % · Liquid FIRE % · Sustainable Income · State Pension start · Property Transition marker · Confidence Score · Latest AI Assessment · Next Milestone. Feels like a Garmin training calendar, not a spreadsheet.

## 7. Scenario engine

- Named scenarios stored per user with cloned assumption set
- Deterministic projection engine (`src/lib/finance/projection.ts`): year-by-year portfolio value, withdrawal, income from each source, tax-aware where modelled
- Optional Monte Carlo (Phase 3) for probability-of-success
- Comparison view: 2–4 scenarios overlaid on income/portfolio-value charts
- AI commentary per scenario

## 8. Property & income source modules

Both ship in v1 schema and have full CRUD UIs. Property includes rental P&L; income sources support multi-currency, inflation behaviour (CPI/fixed/none), tax status, and per-scenario on/off toggle.

## 9. Document library

v1: upload + categorise + view. Phase 4: embeddings (Gemini embeddings) + RAG search so the coach can cite "your will, section 3" or "your 2024 SIPP statement".

## 10. UI system

- Light theme primary (calm, off-white surfaces), dark mode as Phase 2
- Semantic tokens only in `src/styles.css`: surface levels, status (positive/negative/warning/neutral), 8-hue chart palette tuned for accessibility
- Typography: refined sans for UI, tabular numerics for figures
- shadcn/ui customised via variants — no hardcoded colours in components
- Recharts wrapped in `ChartShell` with consistent margins, grid, and tooltip styling
- Every chart has a one-line caption answering "what question does this answer?"

## 11. Phased rollout

| Phase | Scope | Ships |
|---|---|---|
| **1 (this turn)** | Deploy infra · auth · schema · design system · module shell · Dashboard · Portfolio (holdings CRUD + analytics) · Retirement form + flightpath visual · Settings | Self-hosted-ready app you can deploy today |
| 2 | Statement upload + AI extraction · snapshots + history comparison | |
| 3 | Scenario engine + comparison · AI Coach chat (threaded, DB-persisted) | |
| 4 | Property & income source full UIs · Quarterly Review PDF · Document library + RAG · Notifications | |
| 5 | Remaining placeholder modules (Estate, Tax, Insurance) as user prioritises | |

## 12. Technical details (skip if non-technical)

- **TanStack Start Node target**: `vite.config.ts` → `tanstackStart({ target: 'node-server' })`, custom `server.js` reads `PORT`/`HOST`
- **No Cloudflare-specific code**: drop `unenv`-only paths; use native Node `fs`/`crypto`/`stream` freely
- **Server functions** for app-internal logic, server routes for `/api/public/webhooks/*` and `/healthz`
- **Auth bearer** auto-attached via `attachSupabaseAuth` in `src/start.ts`
- **Calculators** pure functions, vitest-covered, never call network
- **AI Gateway** provider helper in `src/lib/ai/gateway.server.ts`, run-id propagation per knowledge
- **Migrations**: every `CREATE TABLE` paired with GRANTs and RLS in the same migration
- **PDF parsing** with `pdf-parse` (Node-friendly); **XLSX** with `xlsx`; **CSV** with `papaparse`
- **Build secrets**: none needed; runtime secrets via `.env`

## 13. Decisions needed before I start

1. **Supabase: managed or self-hosted on the VPS?** Managed Supabase is faster, free tier is generous, you keep `*.supabase.co` URLs. Self-hosting Supabase via Docker is possible but adds significant ops burden (Postgres, GoTrue, Storage, Realtime, Kong). **Recommend: managed Supabase**. Confirm?
2. **AI provider.** Spec says OpenAI; Lovable AI Gateway is the supported path and proxies OpenAI models. **Recommend: Lovable AI Gateway** with `google/gemini-3-flash-preview` for chat (fast/cheap) and `openai/gpt-5` for statement extraction (best accuracy). OK?
3. **Base currency.** UK State Pension implies **GBP base**, with multi-currency holdings converted via stored FX rates. Confirm?
4. **GitHub repo for Actions deploy.** I'll write the workflow assuming GHCR + SSH deploy to the VPS. You'll need to add `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and a `GHCR_PAT` as repo secrets — I'll document this in `DEPLOY.md`. OK?
5. **Phase 1 scope confirmed?** Phase 1 ships infra + auth + schema + Dashboard + Portfolio + Retirement form/flightpath + Settings. Statement upload, scenarios, and AI coach come in Phases 2–3. If you'd rather front-load statement upload (so you can import real data immediately), say so and I'll reorder.

Reply with the four answers (or just "go" to accept recommendations) and I'll build Phase 1 end-to-end.
