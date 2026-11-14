# 5. Stats visibility: public totals, owner details

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

- Public (no key): visit count and countries (`code`, `visits`).
- Owner (valid secretKey): also cities, with latitude and longitude rounded to 0.01 (about 1 km).
- The public JSON and HTML never contain city names, and a test checks this.
- Ids are 7 characters for random links, so they are hard to enumerate.
- Global stats (`/api/v1/stats`) are totals only.

## Drivers

- v2 published cities for any id of 3 characters (S5), which exposes where the people who open a link are.
- The stats page still has to be useful without an account.
- Coordinates at full precision identify places too closely.

## Alternatives considered

- **Everything public, as in v2.** Rejected: privacy of visitors, and short ids made it easy to enumerate.
- **Everything behind the key.** Rejected: loses the public visit counter and the country map.
- **Owner sees full-precision coordinates.** Rejected: the 0.01 rounding is enough for a city map.
- **Country-only for everyone.** Rejected: the owner is the one who benefits from city detail.

## Consequences

- The stats endpoint branches on the Bearer key. Cities are filtered only after the key is checked.
- The stats page and the JSON share the same filter, so they cannot disagree.
- Anyone with a link's key sees its cities. Treat the key as a secret.

## Follow-ups

- Regression test that public HTML and JSON have no `cities` and no city names from the fixture (T9b, T12).
