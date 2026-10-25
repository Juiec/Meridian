import { DatabaseSync } from "node:sqlite";

import { dbPath } from "@/lib/paths";

const pools = new Map<string, DatabaseSync>();

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  skills_index_hash TEXT NOT NULL DEFAULT '',
  compacted_summary TEXT,
  compacted_until_seq INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls TEXT,
  tool_call_id TEXT,
  tool_name TEXT,
  reasoning TEXT,
  attachments TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS messages_session_seq ON messages(session_id, seq);
`;

function columnNames(database: DatabaseSync, table: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function migrate(database: DatabaseSync) {
  const sessions = columnNames(database, "sessions");
  if (sessions.size > 0 && !sessions.has("pinned")) {
    database.exec("ALTER TABLE sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
  }
  if (sessions.size > 0 && !sessions.has("archived")) {
    database.exec("ALTER TABLE sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  const messages = columnNames(database, "messages");
  if (messages.size > 0 && !messages.has("attachments")) {
    database.exec("ALTER TABLE messages ADD COLUMN attachments TEXT");
  }
}

export function db(): DatabaseSync {
  const file = dbPath();
  const existing = pools.get(file);
  if (existing) return existing;
  const database = new DatabaseSync(file);
  database.exec(SCHEMA);
  migrate(database);
  pools.set(file, database);
  return database;
}
