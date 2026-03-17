FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

ARG NEXT_PUBLIC_CP_API_URL=http://localhost:3010
ENV NEXT_PUBLIC_CP_API_URL=$NEXT_PUBLIC_CP_API_URL

COPY package*.json ./
RUN npm install --ignore-scripts

COPY next.config.js tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init wget
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
USER nextjs

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/ || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
