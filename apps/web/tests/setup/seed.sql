CREATE TABLE IF NOT EXISTS icons (
  id         INTEGER PRIMARY KEY,
  collection TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  license    TEXT    NOT NULL,
  categories TEXT,
  tags       TEXT,
  aliases    TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(collection, name)
);

CREATE INDEX IF NOT EXISTS idx_icons_collection ON icons(collection);

CREATE VIRTUAL TABLE IF NOT EXISTS icons_fts USING fts5(
  name, aliases, tags, categories, collection UNINDEXED,
  content='icons', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS synonyms (
  term      TEXT NOT NULL,
  expansion TEXT NOT NULL,
  lang      TEXT NOT NULL,
  weight    REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY(term, expansion, lang)
);

CREATE TABLE IF NOT EXISTS collection_meta (
  collection     TEXT PRIMARY KEY,
  version        TEXT NOT NULL,
  license        TEXT NOT NULL,
  total          INTEGER NOT NULL,
  default_width  INTEGER NOT NULL DEFAULT 24,
  default_height INTEGER NOT NULL DEFAULT 24,
  synced_at      INTEGER NOT NULL
);

INSERT INTO collection_meta VALUES ('mdi', '1.0', 'Apache-2.0', 1, 24, 24, 1);
INSERT INTO collection_meta VALUES ('lucide', '1.0', 'ISC', 1, 24, 24, 1);
INSERT INTO icons (id, collection, name, license, categories, tags, aliases, updated_at)
  VALUES (1, 'mdi', 'home', 'Apache-2.0', 'places', 'building', 'house', 1);
INSERT INTO icons (id, collection, name, license, categories, tags, aliases, updated_at)
  VALUES (2, 'lucide', 'home', 'ISC', 'places', 'building', NULL, 1);
INSERT INTO icons_fts(icons_fts) VALUES('rebuild');
INSERT INTO synonyms VALUES ('house', 'home', 'en', 1.0);
