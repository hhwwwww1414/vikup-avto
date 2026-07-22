# VIKUP web (Next.js) — single-stage image that keeps Prisma CLI + tsx so that
# `prisma migrate deploy` and `create-admin` run in the same container.
FROM node:22-bookworm-slim

WORKDIR /app

# openssl is required by Prisma; ca-certificates for outbound TLS (S3, Telegram).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Limit build-time heap so `next build` stays within a 2 GB VPS (+ swap).
ENV NODE_OPTIONS=--max-old-space-size=1536

# Install ALL dependencies (incl. dev: typescript, tailwind, prisma, tsx) which
# are required to build. NODE_ENV is intentionally NOT "production" here, and
# --include=dev is set so dev deps are installed even if it were.
# Copy the Prisma schema first so the `postinstall` (prisma generate) works.
COPY package.json ./
COPY prisma ./prisma
RUN npm install --include=dev --no-audit --no-fund

COPY . .

RUN npx prisma generate
RUN npm run build

# Runtime is production; compose also sets this. Dev deps remain installed so
# `prisma migrate deploy` and `tsx create-admin` work in the same image.
ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations, ensure the admin exists, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && (node_modules/.bin/tsx scripts/create-admin.ts || true) && npm run start -- -H 0.0.0.0 -p 3000"]
