# syntax=docker/dockerfile:1.10
FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NODE_ENV=development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig*.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/kindred-coach/package.json artifacts/kindred-coach/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY artifacts/api-server artifacts/api-server
COPY artifacts/kindred-coach artifacts/kindred-coach
COPY lib/api-client-react lib/api-client-react
COPY lib/api-zod lib/api-zod
COPY lib/db lib/db
COPY tsconfig.base.json ./

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ARG SOURCE_COMMIT
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT=production
ARG VITE_SENTRY_RELEASE=$SOURCE_COMMIT
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE \
    VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE
RUN --mount=type=secret,id=sentry_auth_token,required=false \
    --mount=type=secret,id=VITE_CLERK_PUBLISHABLE_KEY,env=VITE_CLERK_PUBLISHABLE_KEY,required=false \
    --mount=type=secret,id=VITE_SENTRY_DSN,env=VITE_SENTRY_DSN,required=false \
    export NODE_ENV=production \
           SENTRY_RELEASE="${VITE_SENTRY_RELEASE:-$SOURCE_COMMIT}" \
           SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
 && pnpm --filter @workspace/kindred-coach run build \
 && pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/api-server deploy --prod --legacy /app/runtime

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
RUN groupadd --system --gid 10001 kindred \
 && useradd --system --uid 10001 --gid kindred --home-dir /app kindred
COPY --from=build --chown=kindred:kindred /app/runtime/node_modules ./node_modules
COPY --from=build --chown=kindred:kindred /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build --chown=kindred:kindred /app/artifacts/kindred-coach/dist/public ./artifacts/kindred-coach/dist/public
USER kindred
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
