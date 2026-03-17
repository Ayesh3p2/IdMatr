FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY services/notification-service/package.json ./services/notification-service/package.json

RUN npm ci --ignore-scripts

COPY services/notification-service/ ./services/notification-service/
WORKDIR /app/services/notification-service

RUN /app/node_modules/.bin/tsc --skipLibCheck
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found after TypeScript build" && ls -la dist/ 2>/dev/null && exit 1)

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget openssl
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/notification-service/dist ./dist
COPY --from=builder /app/services/notification-service/package.json ./

ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
USER nestjs

ENV PORT=3007
EXPOSE 3007
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
