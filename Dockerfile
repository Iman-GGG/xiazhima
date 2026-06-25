# Multi-stage build for Next.js (Node 20 + pnpm)
FROM node:20-alpine AS builder
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY . .
RUN pnpm install --frozen-lockfile --prefer-offline
RUN pnpm build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
# Copy built assets and production deps
COPY --from=builder /app/.next .next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["pnpm", "next", "start", "-p", "3000"]
