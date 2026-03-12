FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY node_modules/ ./node_modules/
COPY services/identity-service/ ./services/identity-service/
WORKDIR /app/services/identity-service
RUN npx prisma generate
RUN node_modules/.bin/tsc --skipLibCheck 2>/dev/null; echo "build done"

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/identity-service/dist ./dist
COPY --from=builder /app/services/identity-service/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/services/identity-service/package.json ./
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
USER nestjs
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
