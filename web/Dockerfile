# VIKUP web (Next.js) — single-stage image that keeps Prisma CLI + tsx so that
# `prisma migrate deploy` and `create-admin` run in the same container.
FROM node:22-bookworm-slim

WORKDIR /app

# openssl is required by Prisma; ca-certificates for outbound TLS (S3, Telegram).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Limit build-time heap so `next build` stays within a 2 GB VPS (+ swap).
ENV NODE_OPTIONS=--max-old-space-size=1536

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Apply migrations, ensure the admin exists, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && (node_modules/.bin/tsx scripts/create-admin.ts || true) && npm run start -- -H 0.0.0.0 -p 3000"]
