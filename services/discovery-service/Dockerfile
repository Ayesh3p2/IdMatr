# ── services/discovery-service/Dockerfile ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY services/discovery-service/ ./services/discovery-service/
RUN npm install --workspace=services/discovery-service --include-workspace-root
WORKDIR /app/services/discovery-service
RUN if [ -d "prisma" ]; then npx prisma generate; fi
RUN npx tsc -p tsconfig.json || npx tsc --skipLibCheck -p tsconfig.json

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/discovery-service/dist ./dist
COPY --from=builder /app/services/discovery-service/package.json ./
RUN if [ -d "/app/services/discovery-service/prisma" ]; then mkdir -p prisma && cp -r /app/services/discovery-service/prisma/* prisma/; fi
ENV NODE_ENV=production
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
