use std::fs;
use std::path::PathBuf;

/// `~/Library/Application Support/Raster` (macOS `data_dir`).
pub fn raster_data_dir() -> Option<PathBuf> {
    Some(dirs::data_dir()?.join("Raster"))
}

pub fn ensure_raster_tree() -> std::io::Result<PathBuf> {
    let base = raster_data_dir().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "data directory not found")
    })?;
    fs::create_dir_all(&base)?;
    for sub in ["workflows", "workbooks", "logs", "indexes"] {
        fs::create_dir_all(base.join(sub))?;
    }
    Ok(base)
}

pub fn workflows_dir() -> Option<PathBuf> {
    Some(raster_data_dir()?.join("workflows"))
}

pub fn workbooks_dir() -> Option<PathBuf> {
    Some(raster_data_dir()?.join("workbooks"))
}
