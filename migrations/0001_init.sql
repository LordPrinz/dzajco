CREATE TABLE links (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  secret_hash TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

CREATE INDEX links_expires ON links(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE link_stats (
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  lat REAL,
  lon REAL,
  visits INTEGER NOT NULL,
  PRIMARY KEY (link_id, country, city)
) WITHOUT ROWID;

CREATE TABLE global_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  links INTEGER,
  visits INTEGER,
  countries TEXT,
  updated_at INTEGER
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
) WITHOUT ROWID;
