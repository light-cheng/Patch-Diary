CREATE TABLE IF NOT EXISTS entries (
  date TEXT PRIMARY KEY,
  events_text TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
