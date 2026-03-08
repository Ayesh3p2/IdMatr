# ── apps/api-gateway/Dockerfile ──
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY apps/api-gateway/ ./apps/api-gateway/
RUN npm install --workspace=apps/api-gateway --include-workspace-root
WORKDIR /app/apps/api-gateway
RUN npx tsc -p tsconfig.json || npx tsc --skipLibCheck -p tsconfig.json

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api-gateway/dist ./dist
COPY --from=builder /app/apps/api-gateway/package.json ./
ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
