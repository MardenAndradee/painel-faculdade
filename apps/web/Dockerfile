# =============================================================================
# Web (Next.js) - build multi-stage
# Contexto de build: raiz do monorepo
# =============================================================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# -----------------------------------------------------------------------------
# Desenvolvimento: hot reload do Next, codigo montado por volume no compose.
# -----------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Build de producao (saida standalone do Next)
# -----------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1

# O Next embute as variaveis `NEXT_PUBLIC_*` no bundle do navegador em tempo de
# BUILD. Passa-las apenas como environment do container nao teria efeito: o
# codigo ja teria sido compilado com o valor antigo (ou com o padrao local).
ARG NEXT_PUBLIC_API_URL=http://localhost:3333/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @painel/shared && npm run build --workspace @painel/web

# -----------------------------------------------------------------------------
# Producao
# -----------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
