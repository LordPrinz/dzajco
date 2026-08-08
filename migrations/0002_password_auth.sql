-- Email + password accounts.
--
-- These reuse the existing users table: provider = 'password' and provider_id =
-- the lower-cased e-mail, so the UNIQUE (provider, provider_id) index already
-- enforces one account per address. OAuth rows simply leave password_hash NULL.

ALTER TABLE users ADD COLUMN password_hash TEXT;
