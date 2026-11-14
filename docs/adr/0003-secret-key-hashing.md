# 3. Hash the secretKey with a versioned HMAC pepper

- **Status:** Accepted
- **Date:** 2026-11-13

## Decision

- The secretKey is 128 bits from a CSPRNG, encoded as base64url (22 characters). Every link gets its own
  key. The v2 reuse of one key for "never" links with the same target is removed.
- D1 stores only `v<n>:<hex>` in `secret_hash`, where the hex is `HMAC-SHA256(pepper, key)` (64 characters),
  computed with WebCrypto.
- Peppers are Worker secrets `SECRET_PEPPER_V1`, `SECRET_PEPPER_V2` and so on. They are never written to
  files or logs. The var `SECRET_PEPPER_VERSION` is the current version, and new keys get that prefix.
- Verification reads the version from the stored prefix and uses that pepper. Rotation is: add the next
  pepper secret, then bump `SECRET_PEPPER_VERSION`. Old keys keep verifying.
- The stored and computed hex digests are compared in constant time. The comparison returns false for
  different lengths without throwing.
- The key never goes into a URL or query string. The create response, the `POST /` result page and owner
  stats are sent with `Cache-Control: no-store`.
- The key is shown once, on the result page and in the create response.

## Drivers

- v2 stored the key in plaintext (S6), so a database read exposes every link.
- A key with 128 bits of entropy cannot be brute forced, so a slow hash adds nothing.
- 10 ms CPU per invocation on Free.

## Alternatives considered

- **Plaintext, as in v2.** Rejected: any database leak lets anyone delete links and read city data.
- **bcrypt, scrypt or argon2.** Rejected: the cost is tuned for low-entropy passwords, and it does not fit
  in the 10 ms CPU limit. It protects nothing here because the key is random and long.
- **SHA-256 of pepper and key with one pepper.** Rejected: rotating the pepper would invalidate every key.
- **SHA-256 without a pepper.** Rejected. 128-bit keys already resist brute force, but the pepper adds
  defense in depth: a leaked D1 dump alone cannot be used to test candidate keys.
- **Accounts and sessions.** Out of scope.

## Consequences

- A lost key cannot be recovered or reset. The UI warns about this.
- Rotation keeps old keys working, but an old pepper secret must stay deployed while any key uses it.
- The migration from MongoDB hashes the old keys with the current pepper version (`SECRET_PEPPER_V<n>` from the
  environment). The generated SQL contains hashes only.
- Old v2 keys keep working after the migration, because the importer hashes them the same way.
- The `Authorization: Bearer <key>` value must be a string. An object is a schema error (S1).

## Follow-ups

- Test that the `secret_hash` column is `v<n>:` plus 64 hex and never equals the key.
- Test rotation: a v1 key verifies after the version is bumped to 2.
- Document pepper handling in `DEPLOYMENT.md`.
