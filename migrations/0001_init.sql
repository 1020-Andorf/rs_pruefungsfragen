CREATE TABLE IF NOT EXISTS questions (
  number INTEGER PRIMARY KEY CHECK(number BETWEEN 1 AND 9999),
  question TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS answer_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_number INTEGER NOT NULL REFERENCES questions(number) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(question_number, position)
);
CREATE INDEX IF NOT EXISTS idx_blocks_question ON answer_blocks(question_number, position);
CREATE TABLE IF NOT EXISTS login_attempts (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0
);
