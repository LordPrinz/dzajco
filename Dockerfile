# Dev and test image: `wrangler dev` with a local D1 database, for `bun run infra:up` and the Docker CI job.
# Not a production image: production is a Cloudflare Worker deployed with `wrangler deploy`.
# Debian (glibc) because workerd does not run on musl. Base images are pinned by digest.

# oven/bun:1.4.4 is the Debian variant; only its bun binary is used.
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS bun

# node:26-bookworm-slim (Node 26.13.1, the version CI pins in setup-node)
FROM node:26-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
# workerd needs the system CA store for its outbound TLS configuration; the slim image ships without it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV HUSKY=0 \
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false \
    WRANGLER_SEND_METRICS=false \
    CI=1
WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY --chown=node:node . .
RUN bun run build:client

# Local D1 state lives here; compose mounts a volume on it. Created first so volumes inherit node ownership.
RUN mkdir -p /app/.wrangler/state /app/.wrangler/tmp
VOLUME /app/.wrangler/state
EXPOSE 8787
ENTRYPOINT ["/app/infra/entrypoint.sh"]
