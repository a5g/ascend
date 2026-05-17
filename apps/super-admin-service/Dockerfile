FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace config
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./

# Copy packages
COPY packages ./packages
COPY apps/super-admin-service ./apps/super-admin-service

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ascend/super-admin-service build

FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/super-admin-service ./apps/super-admin-service

WORKDIR /app/apps/super-admin-service

EXPOSE 3006
CMD ["pnpm", "start"]
