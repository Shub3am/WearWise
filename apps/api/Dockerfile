# syntax=docker/dockerfile:1
# Why: production image for the API, running its TS source directly on Node.
# Must not: use pnpm deploy; it copies workspace packages under node_modules, where Node refuses to strip types.
FROM node:24.21.0-trixie-slim AS production-dependencies
ENV PNPM_HOME=/pnpm
# npm, not corepack: newer Node images no longer ship corepack.
RUN npm install --global pnpm@12.5.1
WORKDIR /app
# The whole workspace, not hand picked manifests: a missing workspace manifest builds fine and fails at runtime.
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@wearwise/api..."

FROM node:24.21.0-trixie-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies /app /app
USER node
EXPOSE 3000
CMD ["node", "apps/api/src/server.ts"]
