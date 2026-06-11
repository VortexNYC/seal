FROM oven/bun:1.3.10 AS builder

WORKDIR /app

ARG VITE_PUBLIC_POSTHOG_KEY=""
ARG VITE_APP_URL="https://app.seal.nyc"

ENV VITE_PUBLIC_POSTHOG_KEY=${VITE_PUBLIC_POSTHOG_KEY}
ENV VITE_APP_URL=${VITE_APP_URL}

COPY package.json bun.lock bunfig.toml ./
COPY apps ./apps
COPY packages ./packages
COPY tooling ./tooling

RUN bun install --frozen-lockfile --ignore-scripts
RUN cd apps/landing && bun run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/landing/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
