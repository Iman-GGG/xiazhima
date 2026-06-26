# Multi-stage build for Next.js custom server (Node 20 + pnpm)
FROM node:20-alpine AS builder
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Layer 1: dependencies (cache-friendly)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prefer-offline

# Layer 2: source + build
COPY . .
RUN pnpm build

# === Runner stage ===
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy only production artefacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/server.js"]
