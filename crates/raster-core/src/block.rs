use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Stable identifier for a command/output block in the scrollback model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct BlockId(pub Uuid);

impl BlockId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for BlockId {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BlockStatus {
    Running,
    Finished { exit_code: Option<i32> },
}

/// One atomic unit: command + streams + metadata (PROMPT.md block model subset).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: BlockId,
    pub session_id: String,
    pub command_text: String,
    pub cwd: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub status: BlockStatus,
    /// Bounded stdout tail for persistence (full stream stays in memory in v0 UI).
    pub stdout_preview: String,
    pub stderr_preview: String,
}

impl Block {
    pub fn new_running(session_id: impl Into<String>, command_text: impl Into<String>, cwd: impl Into<String>) -> Self {
        Self {
            id: BlockId::new(),
            session_id: session_id.into(),
            command_text: command_text.into(),
            cwd: cwd.into(),
            started_at: Utc::now(),
            ended_at: None,
            status: BlockStatus::Running,
            stdout_preview: String::new(),
            stderr_preview: String::new(),
        }
    }

    pub fn finish(&mut self, exit_code: Option<i32>, stdout_tail: String, stderr_tail: String) {
        self.ended_at = Some(Utc::now());
        self.status = BlockStatus::Finished { exit_code };
        self.stdout_preview = truncate(&stdout_tail, 32_768);
        self.stderr_preview = truncate(&stderr_tail, 8_192);
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    format!("…{}", &s[s.len().saturating_sub(max)..])
}
