FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate --schema prisma/schema.postgres.prisma
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005

COPY --from=builder /app /app

EXPOSE 3005

CMD ["npm", "run", "start"]
