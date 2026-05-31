# syntax=docker/dockerfile:1.7
# Multi-stage build fuer Next.js 16 mit output: 'standalone'.
# Final-Image ~150MB statt 1.2GB (full node_modules).
#
# Sprint Hetzner (2026-05-30). Wird von Coolify auf Hetzner gebaut.
# Vercel-Build bleibt unbeeinflusst — Vercel ignoriert Dockerfile, nutzt
# weiterhin Build-Packs.

# ──────────────────────────────────────────────────────────────────────
# Stage 1: deps — install node_modules (gecacht zwischen builds)
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Sharp braucht libc6-compat fuer next/image
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --omit=optional --no-audit --no-fund

# ──────────────────────────────────────────────────────────────────────
# Stage 2: build — Next.js production build
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry — schneller + privacy
ENV NEXT_TELEMETRY_DISABLED=1

# Build benutzt nur PUBLIC env-vars + Server-Env zur Build-Time. Runtime
# Env-Vars (SUPABASE_SERVICE_ROLE_KEY etc.) kommen erst im Container per
# Coolify-Inject — also NICHT als ARG hier verfuegbar machen, sonst leak
# ins Image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN

RUN npm run build

# ──────────────────────────────────────────────────────────────────────
# Stage 3: runner — minimaler production image
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy nur was Next.js standalone braucht
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Healthcheck nutzt unseren /api/health Endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
