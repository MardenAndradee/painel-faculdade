# =============================================================================
# API - build multi-stage
# Contexto de build: raiz do monorepo (precisa de packages/shared)
# =============================================================================

FROM node:20-alpine AS base
WORKDIR /app
# openssl e exigido pelo engine do Prisma em imagens alpine.
RUN apk add --no-cache openssl

# -----------------------------------------------------------------------------
# Dependencias: camada separada para aproveitar o cache enquanto os manifests
# nao mudarem.
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci

# -----------------------------------------------------------------------------
# Desenvolvimento: hot reload via tsx, codigo montado por volume no compose.
# -----------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
WORKDIR /app/apps/api
EXPOSE 3333
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Build de producao
# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @painel/shared \
  && npx prisma generate --schema=apps/api/prisma/schema.prisma \
  && npm run build --workspace @painel/api

# -----------------------------------------------------------------------------
# Producao: apenas artefatos compilados e dependencias de runtime.
# -----------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# A pasta de uploads precisa existir E pertencer ao usuario da aplicacao: o
# provider de storage local grava nela, e um container que roda como nao-root
# nao consegue criar diretorio na raiz depois de iniciado.
RUN mkdir -p /app/uploads

# Nunca rodar como root em producao.
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001 -G nodejs \
  && chown -R api:nodejs /app
USER api

# Consumido pelo provider de storage local; o compose de producao monta um
# volume nomeado neste caminho para os arquivos sobreviverem a um deploy.
ENV UPLOAD_DIR=/app/uploads

WORKDIR /app/apps/api
EXPOSE 3333
CMD ["npm", "run", "start"]
