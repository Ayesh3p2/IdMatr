FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY services/policy-engine/package.json ./services/policy-engine/package.json

RUN npm install --ignore-scripts

COPY services/policy-engine/ ./services/policy-engine/
WORKDIR /app/services/policy-engine

RUN npx prisma generate
RUN /app/node_modules/.bin/tsc --skipLibCheck
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found after TypeScript build" && ls -la dist/ 2>/dev/null && exit 1)

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget openssl
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/policy-engine/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/services/policy-engine/package.json ./

ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
USER nestjs

ENV PORT=3005
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
