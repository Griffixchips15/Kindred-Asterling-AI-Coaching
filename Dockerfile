FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN npm install --global pnpm@10

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm --filter @workspace/db run push

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN npm install --global pnpm@10

COPY --from=build /app /app

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
