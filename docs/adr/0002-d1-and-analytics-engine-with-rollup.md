# 2. D1 and Analytics Engine with a rollup, instead of KV or a D1 upsert per visit

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

- Links and aggregated stats live in D1.
- Each visit is a Workers Analytics Engine data point, written inside `waitUntil`. It carries the link's
  `created_at`, so the rollup and the live merge count visits per link and not per id: a deleted id that is
  created again starts at zero.
- An hourly cron rolls AE data up into D1 `link_stats`, one day at a time, in pages of 500 groups. A cursor
  `{day, offset}` is saved in the same `db.batch` as the upserts, so a repeated page changes nothing.
- Stats for data after the cursor are read from the AE SQL API (two queries cached for 5 minutes per colo,
  with the cursor in the cache key).
- `global_stats` is one row recomputed by the cron. The redirect path reads the record through the Cache API
  (TTL at most 60 s) and then D1.

## Drivers

- D1 writes: 100k per day on Free.
- AE has its own budget: 100k data points and 10k queries per day.
- 10 ms CPU and redirect latency.
- A failing stats path must not break redirects.

## Alternatives considered

- **KV.** Rejected: 1k writes per day on Free and delayed propagation.
- **D1 upsert per visit.** Rejected: 50k to 90k visits per day would use most of the D1 write budget and
  leave little for creating links.
- **D1 with sampling.** Rejected: numbers are approximate under load and the code is more complex.
- **`SUM` over `link_stats` for global stats.** Rejected: a full scan on each request, about 28.8M reads per
  day at the traffic limit.
- **A counter updated on every write.** Rejected: one hot row written on every visit.
- **D1 read replication for the redirect read.** Not now. Needs a latency measurement first.

## Consequences

- Today's stats for an owner depend on the SQL API (token `CF_AE_TOKEN`, 10k queries per day). On error the
  API returns D1 data with `partial: true`.
- The rollup needs a token and a cron. Day D closes after `D+1 01:00 UTC`. A late ingest can skip or double
  count a few visits (accepted).
- AE samples at high volume, so the rollup sums `_sample_interval`.
- AE keeps data for 3 months. The daily rollup keeps long-term data in D1.
- The index is limited to 96 bytes, so ids and custom names are limited to 96 bytes in UTF-8.
- `GET /api/v1/stats` can lag by up to about 24 hours.
- Local development has no SQL API. `LocalVisitSource` returns nothing.
- The cache can serve a stale record for up to 60 s between colos.
- Rollup CPU is limited by `ROLLUP_MAX_PAGES`, tuned after measuring.

## Follow-ups

- Alarm at 7k AE queries per day. If reached, raise `AE_FRESH_TTL` to 15 minutes.
- Check the real SQL API query against the `dzajco_visits` dataset in T16.
- Consider D1 read replication after measuring redirect latency.
- On Paid, consider Queues for stats.
