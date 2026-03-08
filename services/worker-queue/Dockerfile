# ── services/worker-queue/Dockerfile ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY services/worker-queue/ ./services/worker-queue/
RUN npm install --workspace=services/worker-queue --include-workspace-root
WORKDIR /app/services/worker-queue
RUN if [ -d "prisma" ]; then npx prisma generate; fi
RUN npx tsc -p tsconfig.json || npx tsc --skipLibCheck -p tsconfig.json

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/worker-queue/dist ./dist
COPY --from=builder /app/services/worker-queue/package.json ./
RUN if [ -d "/app/services/worker-queue/prisma" ]; then mkdir -p prisma && cp -r /app/services/worker-queue/prisma/* prisma/; fi
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
