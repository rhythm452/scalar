FROM node:20-slim AS base
WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install
COPY . .
EXPOSE 3000

FROM base AS dev
CMD ["pnpm", "dev"]

FROM base AS prod
RUN pnpm build
CMD ["pnpm", "start"]
