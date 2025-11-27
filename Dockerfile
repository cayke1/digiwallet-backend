FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN DATABASE_URL="placeholder" pnpm dlx prisma generate

RUN pnpm run build


FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma


RUN DATABASE_URL="placeholder" pnpm dlx prisma generate

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
