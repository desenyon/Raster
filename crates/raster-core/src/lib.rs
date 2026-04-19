//! Raster core: terminal block model and local SQLite persistence.

pub mod block;
pub mod db;
pub mod error;

pub use block::{Block, BlockId, BlockStatus};
pub use db::Database;
pub use error::CoreError;
