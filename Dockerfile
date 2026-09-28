# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DISCORD_CLIENT_ID
ENV NODE_ENV=production \
    DATABASE_URL=file:/tmp/guildpilot-build.db \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_DISCORD_CLIENT_ID=${NEXT_PUBLIC_DISCORD_CLIENT_ID}
COPY . .
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund

FROM base AS backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV PORT=3001 \
    HOST=0.0.0.0 \
    DOCKER_DEPLOYMENT=true
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node docker/backend-entrypoint.sh /usr/local/bin/guildpilot-entrypoint
RUN chmod 0555 /usr/local/bin/guildpilot-entrypoint
USER node
EXPOSE 3001
ENTRYPOINT ["guildpilot-entrypoint"]

FROM base AS frontend
ENV PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
