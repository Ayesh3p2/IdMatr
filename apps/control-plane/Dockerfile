FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/control-plane/package.json apps/control-plane/package.json
COPY apps/control-plane/prisma apps/control-plane/prisma

RUN npm install

COPY apps/control-plane apps/control-plane

RUN npm --workspace apps/control-plane run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/control-plane/package.json ./apps/control-plane/package.json
COPY --from=build /app/apps/control-plane/dist ./apps/control-plane/dist
COPY --from=build /app/apps/control-plane/prisma ./apps/control-plane/prisma

EXPOSE 3001

CMD ["sh", "-c", "cd apps/control-plane && npx prisma db push --skip-generate && node dist/main.js"]
