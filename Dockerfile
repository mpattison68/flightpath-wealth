# syntax=docker/dockerfile:1.7

# ---------- builder ----------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install deps with cached layer
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Build the app — target Node server (nitro), not Cloudflare
COPY . .
# Vite bakes VITE_* vars at build time. Pass them as build args so the
# browser bundle can talk to Supabase in production. Values are publishable
# (safe to expose in the client bundle).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV NITRO_PRESET=node-server \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN bun run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy the standalone Nitro Node output
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Non-root user
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT}/api/healthz" || exit 1

CMD ["node", ".output/server/index.mjs"]