# Deploying Wealth Flightpath AI to your Hostinger VPS

Stack: Ubuntu 24.04 · Docker · Docker Compose · Portainer · Nginx Proxy Manager · Let's Encrypt · GitHub Actions · Supabase.

## 1. Prepare the VPS

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
mkdir -p /opt/wealth-flightpath
cd /opt/wealth-flightpath
```

Copy `docker-compose.yml` and `.env.example` to this folder. Rename `.env.example` to `.env` and fill in real values (see below).

## 2. Environment variables

Required (see `.env.example` for the full list):

| Variable | Where to get it |
| --- | --- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase project dashboard |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server only) |
| `LOVABLE_API_KEY` | Lovable workspace |
| `APP_PORT` | Host port to expose (default 3000) |

## 3. Nginx Proxy Manager

1. Add a new Proxy Host pointing your domain (e.g. `wealth.example.com`) to `http://<vps-ip>:${APP_PORT}`.
2. Enable WebSocket support, Block Common Exploits, and Force SSL.
3. Request a Let's Encrypt certificate from NPM.

The app never sees TLS; NPM terminates it and forwards plain HTTP.

## 4. GitHub Actions deploy

Set repo secrets:

| Secret | Description |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | SSH user (with docker group) |
| `VPS_SSH_KEY` | Private SSH key for that user |
| `VPS_APP_DIR` | Path on VPS, e.g. `/opt/wealth-flightpath` |
| `GHCR_PAT` | GitHub PAT with `read:packages` |
| `VITE_SUPABASE_URL` | Supabase project URL (baked into client bundle at build time) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (baked into client bundle at build time) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |

> **Important:** `VITE_*` variables are read by Vite at **build time**, not
> runtime. They must be provided as GitHub Actions secrets (for the GHCR
> image build) AND set in `.env` on the VPS (for local `docker compose
> build`). Without them, the browser bundle has no Supabase URL and every
> auth/data screen shows "This page didn't load".

Push to `main` → workflow builds the image, pushes to GHCR, SSHes into the VPS and runs `docker compose pull && up -d`.

## 5. Manual run (without CI)

```bash
cd /opt/wealth-flightpath
docker compose build
docker compose up -d
docker compose logs -f
```

## 6. Health check

`GET /api/healthz` returns `{"ok":true,"ts":...}`. Used by Docker, NPM and your monitor.

## 7. Updating

```bash
docker compose pull && docker compose up -d
```

Or just push to `main` and let GitHub Actions handle it.

## Notes

- The Docker build sets `NITRO_PRESET=node-server` so the bundle is a standard Node server (`node .output/server/index.mjs`). No Cloudflare runtime.
- Container runs as a non-root user (`app`).
- All secrets live in `.env` on the VPS; never commit them.