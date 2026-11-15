-- Links deleted by their owner, kept for 30 days for abuse reports and mistakes. Rows are keyed by
-- the implicit rowid, not the link id: the name is free again at once, so one id can appear more
-- than once. The secret hash is not kept. `visits` and `countries` are the rolled-up stats at delete
-- time; `countries` is JSON, [{"code":"PL","visits":3},...], most visits first.
CREATE TABLE deleted_links (
  id TEXT NOT NULL,
  target TEXT NOT NULL,
  target_host TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  is_custom INTEGER NOT NULL,
  deleted_at INTEGER NOT NULL,
  visits INTEGER NOT NULL,
  countries TEXT NOT NULL
);

CREATE INDEX deleted_links_deleted_at ON deleted_links(deleted_at);
CREATE INDEX deleted_links_id ON deleted_links(id);
