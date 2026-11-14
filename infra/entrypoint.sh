#!/bin/sh
# Applies the D1 migrations to the local database, then serves the Worker with `wrangler dev`.
set -eu

# .dev.vars is the only local secrets source (the Worker ignores .env files).
umask 077
printf 'SECRET_PEPPER_V1=%s\n' "${SECRET_PEPPER_V1:?set SECRET_PEPPER_V1}" > .dev.vars

./node_modules/.bin/wrangler d1 migrations apply DB --local
exec ./node_modules/.bin/wrangler dev --ip 0.0.0.0 --port 8787
