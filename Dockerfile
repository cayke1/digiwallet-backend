FROM node:22.21.0-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar restante do código fonte
COPY . .

# 🔥 Importante: gerar Prisma Client antes do build
RUN DATABASE_URL="placeholder" pnpm dlx prisma generate

# Agora sim pode buildar
RUN pnpm run build

# Executar Prisma Studio + App
CMD sh -c "node dist/src/main.js"
