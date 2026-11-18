CREATE TABLE quiz_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL
);
