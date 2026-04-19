use std::path::Path;

use rusqlite::{params, Connection};

use crate::block::{Block, BlockId, BlockStatus};
use crate::error::Result;

/// Local SQLite store under the app support path (opened by the shell process).
pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            r"
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                shell TEXT NOT NULL,
                cwd TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS blocks (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                command_text TEXT NOT NULL,
                cwd TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                exit_code INTEGER,
                stdout_preview TEXT NOT NULL DEFAULT '',
                stderr_preview TEXT NOT NULL DEFAULT ''
            );
            INSERT OR IGNORE INTO schema_version(version) VALUES (1);
            ",
        )?;
        Ok(())
    }

    pub fn insert_session(&self, id: &str, shell: &str, cwd: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO sessions (id, shell, cwd, created_at) VALUES (?1, ?2, ?3, datetime('now'))",
            params![id, shell, cwd],
        )?;
        Ok(())
    }

    pub fn insert_block(&self, block: &Block) -> Result<()> {
        let (exit_code, ended_at) = match &block.status {
            BlockStatus::Running => (None::<i32>, None::<String>),
            BlockStatus::Finished { exit_code } => (*exit_code, block.ended_at.map(|t| t.to_rfc3339())),
        };
        self.conn.execute(
            "INSERT OR REPLACE INTO blocks (id, session_id, command_text, cwd, started_at, ended_at, exit_code, stdout_preview, stderr_preview)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                block.id.0.to_string(),
                block.session_id,
                block.command_text,
                block.cwd,
                block.started_at.to_rfc3339(),
                ended_at,
                exit_code,
                block.stdout_preview,
                block.stderr_preview,
            ],
        )?;
        Ok(())
    }

    pub fn list_recent_blocks(&self, limit: usize) -> Result<Vec<Block>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, command_text, cwd, started_at, ended_at, exit_code, stdout_preview, stderr_preview
             FROM blocks ORDER BY started_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            let ended_at: Option<String> = row.get(5)?;
            let exit_code: Option<i32> = row.get(6)?;
            let status = if ended_at.is_some() || exit_code.is_some() {
                BlockStatus::Finished { exit_code }
            } else {
                BlockStatus::Running
            };
            Ok(Block {
                id: BlockId(uuid::Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| uuid::Uuid::new_v4())),
                session_id: row.get(1)?,
                command_text: row.get(2)?,
                cwd: row.get(3)?,
                started_at: row
                    .get::<_, String>(4)?
                    .parse()
                    .unwrap_or_else(|_| chrono::Utc::now()),
                ended_at: ended_at.and_then(|s| s.parse().ok()),
                status,
                stdout_preview: row.get(7)?,
                stderr_preview: row.get(8)?,
            })
        })?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn roundtrip_block() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("state.db");
        let db = Database::open(&path).unwrap();
        db.insert_session("s1", "/bin/zsh", "/tmp").unwrap();
        let mut b = Block::new_running("s1", "echo hi", "/tmp");
        b.finish(Some(0), "hi\n".into(), String::new());
        db.insert_block(&b).unwrap();
        let list = db.list_recent_blocks(10).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].command_text, "echo hi");
    }
}
