# ── services/identity-service/Dockerfile ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy workspace root
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/

# Copy this service
COPY services/identity-service/ ./services/identity-service/

# Install deps
RUN npm install --workspace=services/identity-service --include-workspace-root

# Generate Prisma client
WORKDIR /app/services/identity-service
RUN npx prisma generate

# Build TypeScript
RUN npx tsc -p tsconfig.json || npx tsc --skipLibCheck -p tsconfig.json

# ── Runner ──
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/identity-service/dist ./dist
COPY --from=builder /app/services/identity-service/prisma ./prisma
COPY --from=builder /app/services/identity-service/package.json ./

ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
