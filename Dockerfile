FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm ci

COPY prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate

ARG AUTH_SECRET_BUILD=dummy-build-secret
ENV AUTH_SECRET=$AUTH_SECRET_BUILD
ENV AUTH_TRUST_HOST=true
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cacss"

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
