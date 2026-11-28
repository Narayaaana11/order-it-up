# Standalone multi-stage build for Order It Up Unified Oracle Cloud Backend
# Build context is backend/ itself — supports linux/arm64 (OCI Ampere A1) and linux/amd64
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund && npm rebuild better-sqlite3

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

RUN npm run build

# Runtime stage
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/oiu-unified.db
ENV BACKUP_DIR=/backups

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

RUN npm prune --omit=dev && mkdir -p /data /backups /app/static \
    && chown -R node:node /data /backups /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["node", "dist/index.js"]
