use std::fs;

use serde::Serialize;

use crate::paths::workbooks_dir;

const MAX_READ: usize = 512_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkbookItem {
    pub name: String,
    pub file_name: String,
}

pub fn list() -> Result<Vec<WorkbookItem>, String> {
    let dir = workbooks_dir().ok_or("workbooks path missing")?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = vec![];
    for e in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let p = e.path();
        if p.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let file_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let name = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        out.push(WorkbookItem { name, file_name });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn read_file(file_name: &str) -> Result<String, String> {
    if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') {
        return Err("invalid file name".into());
    }
    let dir = workbooks_dir().ok_or("workbooks path missing")?;
    let p = dir.join(file_name);
    if !p.exists() {
        return Err("not found".into());
    }
    let data = fs::read(&p).map_err(|e| e.to_string())?;
    if data.len() > MAX_READ {
        return Err("file too large".into());
    }
    String::from_utf8(data).map_err(|e| e.to_string())
}
