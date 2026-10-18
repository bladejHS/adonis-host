# Imagine comună pentru cele trei servicii Adonis Host. Alegeți ținta la build:
#   docker build --target api   -t adonis-api .
#   docker build --target admin -t adonis-admin .
#   docker build --target guest -t adonis-guest .

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/admin/package.json apps/admin/
COPY apps/guest/package.json apps/guest/
COPY apps/api/package.json apps/api/
COPY apps/staff-mobile/package.json apps/staff-mobile/
COPY packages/core/package.json packages/core/
COPY packages/database/package.json packages/database/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN pnpm install --frozen-lockfile --filter "!@adonis/staff-mobile"

FROM deps AS source
COPY . .
# Producția rulează pe PostgreSQL
RUN node scripts/prisma-provider.mjs postgresql && pnpm --filter @adonis/database exec prisma generate

FROM source AS api
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
WORKDIR /repo/apps/api
# migrările se aplică la pornire (idempotent), apoi pornește API-ul
CMD ["sh", "-c", "cd ../../packages/database && npx prisma migrate deploy && cd ../../apps/api && npx tsx src/main.ts"]

FROM source AS admin-build
RUN pnpm --filter @adonis/admin build

FROM admin-build AS admin
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /repo/apps/admin
CMD ["npx", "next", "start", "-p", "3000"]

FROM source AS guest-build
RUN pnpm --filter @adonis/guest build

FROM guest-build AS guest
ENV NODE_ENV=production
EXPOSE 3001
WORKDIR /repo/apps/guest
CMD ["npx", "next", "start", "-p", "3001"]
