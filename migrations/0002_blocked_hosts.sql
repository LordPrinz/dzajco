CREATE TABLE blocked_hosts (
  host TEXT PRIMARY KEY,
  reason TEXT,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;
