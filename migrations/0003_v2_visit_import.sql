-- Ledger of the imported v2 visit counters; see docs/DESIGN.md (D1 schema) for how it is used.
CREATE TABLE v2_visit_import (
  link_id TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  lat REAL,
  lon REAL,
  visits INTEGER NOT NULL,
  PRIMARY KEY (link_id, country, city)
) WITHOUT ROWID;

-- Same merge as the rollup upsert.
CREATE TRIGGER v2_visit_import_apply AFTER INSERT ON v2_visit_import
BEGIN
  INSERT INTO link_stats (link_id, country, city, lat, lon, visits)
  VALUES (NEW.link_id, NEW.country, NEW.city, NEW.lat, NEW.lon, NEW.visits)
  ON CONFLICT (link_id, country, city) DO UPDATE SET
    lat = CASE WHEN excluded.lat IS NULL THEN lat WHEN lat IS NULL THEN excluded.lat
      ELSE round((lat * visits + excluded.lat * excluded.visits) / (visits + excluded.visits), 2) END,
    lon = CASE WHEN excluded.lon IS NULL THEN lon WHEN lon IS NULL THEN excluded.lon
      ELSE round((lon * visits + excluded.lon * excluded.visits) / (visits + excluded.visits), 2) END,
    visits = visits + excluded.visits;
END;
