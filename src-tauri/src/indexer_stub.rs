use serde::Serialize;

/// Placeholder until Tantivy + embeddings land (PROMPT.md).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerStatus {
    pub state: String,
    pub message: String,
    pub file_count: u32,
}

pub fn status() -> IndexerStatus {
    IndexerStatus {
        state: "idle".into(),
        message: "Full-text and semantic index not started yet. SQLite blocks and session metadata are active."
            .into(),
        file_count: 0,
    }
}
