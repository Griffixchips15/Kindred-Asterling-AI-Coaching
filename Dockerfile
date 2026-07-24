FROM node:24-bookworm-slim AS build

ARG CACHEBUST=1

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN npm install --global pnpm@10

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY artifacts/kindred-coach/package.json ./artifacts/kindred-coach/package.json
COPY lib/ lib/
COPY scripts/package.json ./scripts/package.json

RUN rm -f pnpm-lock.yaml && pnpm install

COPY . .

RUN pnpm -r --if-present run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN npm install --global pnpm@10

COPY --from=build /app /app

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
