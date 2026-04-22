mod indexer_stub;
mod ollama_client;
mod paths;
mod pty;
mod settings;
mod workflows;
mod workbooks;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};

use indexer_stub::IndexerStatus;
use ollama_client::{OllamaGenerateResult, OllamaListResult, generate, list_models};
use paths::ensure_raster_tree;
use pty::PtyManager;
use raster_core::{Block, Database};
use serde::Serialize;
use settings::{AppSettings, SettingsState, save_settings_to_disk};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub cwd: String,
}

pub struct AppState {
    pub pty: Arc<PtyManager>,
    pub db: Mutex<Database>,
    pub settings: Arc<SettingsState>,
}

fn data_db_path() -> Option<PathBuf> {
    Some(dirs::data_dir()?.join("Raster").join("state.db"))
}

fn workspace_root() -> Result<PathBuf, String> {
    let p = std::env::current_dir().map_err(|e| e.to_string())?;
    p.canonicalize().map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_spawn(state: State<'_, AppState>, app: AppHandle, cols: u16, rows: u16) -> Result<String, String> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));
    let id = state.pty.spawn(&app, cwd.clone(), cols, rows)?;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    state
        .db
        .lock()
        .map_err(|_| "database mutex poisoned".to_string())?
        .insert_session(&id, &shell, cwd.to_string_lossy().as_ref())
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn pty_write(state: State<'_, AppState>, session_id: String, data: Vec<u8>) -> Result<(), String> {
    state.pty.write(&session_id, &data)
}

#[tauri::command]
fn pty_resize(state: State<'_, AppState>, session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    state.pty.resize(&session_id, cols, rows)
}

#[tauri::command]
fn pty_close(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    state.pty.close(&session_id)
}

#[tauri::command]
fn blocks_recent(state: State<'_, AppState>, limit: u32) -> Result<Vec<Block>, String> {
    state
        .db
        .lock()
        .map_err(|_| "database mutex poisoned".to_string())?
        .list_recent_blocks(limit as usize)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn workspace_info() -> Result<WorkspaceInfo, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    Ok(WorkspaceInfo {
        cwd: cwd.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn git_branch() -> Result<Option<String>, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Ok(None);
    }
    Ok(Some(
        String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_string(),
    ))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileEntry {
    pub path: String,
    pub index: String,
    pub worktree: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusInfo {
    pub branch: Option<String>,
    pub clean: bool,
    #[serde(rename = "inRepo")]
    pub in_repo: bool,
    pub files: Vec<GitFileEntry>,
}

#[tauri::command]
fn git_status() -> Result<GitStatusInfo, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let branch = match Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&cwd)
        .output()
    {
        Ok(o) if o.status.success() => Some(
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .to_string(),
        ),
        _ => None,
    };
    if branch.is_none() {
        return Ok(GitStatusInfo {
            branch: None,
            clean: true,
            in_repo: false,
            files: Vec::new(),
        });
    }
    let output = Command::new("git")
        .args(["status", "--porcelain=1", "-uall"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Ok(GitStatusInfo {
            branch,
            clean: true,
            in_repo: true,
            files: Vec::new(),
        });
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();
    for line in text.lines() {
        if line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix("?? ") {
            files.push(GitFileEntry {
                path: rest.to_string(),
                index: "?".to_string(),
                worktree: "?".to_string(),
            });
            continue;
        }
        if line.len() < 3 {
            continue;
        }
        let mut it = line.chars();
        let a = it.next().unwrap_or(' ').to_string();
        let b = it.next().unwrap_or(' ').to_string();
        let _ = it.next();
        let path: String = it.collect();
        if !path.is_empty() {
            files.push(GitFileEntry {
                path,
                index: a,
                worktree: b,
            });
        }
    }
    let clean = files.is_empty();
    Ok(GitStatusInfo {
        branch,
        clean,
        in_repo: true,
        files,
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDirResult {
    /// Path relative to workspace root, using `/` (empty = root)
    pub rel_path: String,
    pub parent: Option<String>,
    pub entries: Vec<FsEntry>,
}

#[tauri::command]
fn list_dir(sub_path: Option<String>) -> Result<ListDirResult, String> {
    let root = workspace_root()?;
    let sub = sub_path
        .map(|s| s.trim().replace('\\', "/").trim_start_matches('/').to_string())
        .filter(|s| !s.is_empty());
    if let Some(s) = &sub {
        if s.contains("..") {
            return Err("invalid path".into());
        }
    }
    let target = match &sub {
        None => root.clone(),
        Some(s) => {
            let p = root.join(s);
            p.canonicalize()
                .map_err(|e| e.to_string())?
        }
    };
    if !target.starts_with(&root) {
        return Err("path outside workspace".into());
    }
    let rel_path = target
        .strip_prefix(&root)
        .map_err(|_| "path strip")?
        .to_string_lossy()
        .replace('\\', "/");
    let rel_path = if rel_path.is_empty() {
        String::new()
    } else {
        rel_path
    };
    let parent: Option<String> = if rel_path.is_empty() {
        None
    } else {
        match Path::new(&rel_path).parent() {
            None => None,
            Some(par) => {
                let s = par.to_string_lossy().to_string().replace('\\', "/");
                if s.is_empty() {
                    Some(String::new())
                } else {
                    Some(s)
                }
            }
        }
    };
    let rd = fs::read_dir(&target).map_err(|e: io::Error| e.to_string())?;
    let mut entries: Vec<FsEntry> = rd
        .filter_map(|e| {
            e.ok().and_then(|e| {
                let name = e.file_name().to_string_lossy().into_owned();
                let is_dir = e.file_type().ok()?.is_dir();
                Some(FsEntry { name, is_dir })
            })
        })
        .collect();
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(ListDirResult {
        rel_path,
        parent,
        entries,
    })
}

#[tauri::command]
fn block_submit_command(
    state: State<'_, AppState>,
    session_id: String,
    command_line: String,
    cwd: Option<String>,
) -> Result<Option<String>, String> {
    let line = command_line.trim();
    if line.is_empty() {
        return Ok(None);
    }
    let cwd_buf = if let Some(c) = cwd {
        PathBuf::from(c)
    } else {
        std::env::current_dir().map_err(|e| e.to_string())?
    };
    let mut block = Block::new_running(
        &session_id,
        line,
        cwd_buf.to_string_lossy().as_ref(),
    );
    block.finish(None, String::new(), String::new());
    let id = block.id.0.to_string();
    state
        .db
        .lock()
        .map_err(|_| "database mutex poisoned".to_string())?
        .insert_block(&block)
        .map_err(|e| e.to_string())?;
    Ok(Some(id))
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let s = state
        .settings
        .inner
        .lock()
        .map_err(|_| "settings mutex")?;
    Ok(s.clone())
}

#[tauri::command]
fn update_settings(
    state: State<'_, AppState>,
    ollama_base_url: Option<String>,
    ollama_default_model: Option<String>,
) -> Result<AppSettings, String> {
    let mut s = state
        .settings
        .inner
        .lock()
        .map_err(|_| "settings mutex")?;
    if let Some(v) = ollama_base_url {
        s.ollama_base_url = v.trim().to_string();
    }
    if let Some(v) = ollama_default_model {
        s.ollama_default_model = v.trim().to_string();
    }
    save_settings_to_disk(&s)?;
    Ok(s.clone())
}

#[tauri::command]
fn ollama_list_models(state: State<'_, AppState>) -> Result<OllamaListResult, String> {
    let s = state
        .settings
        .inner
        .lock()
        .map_err(|_| "settings mutex")?;
    Ok(list_models(&s))
}

#[tauri::command]
fn ollama_generate(
    state: State<'_, AppState>,
    model: String,
    prompt: String,
    system: Option<String>,
) -> Result<OllamaGenerateResult, String> {
    let s = state
        .settings
        .inner
        .lock()
        .map_err(|_| "settings mutex")?;
    Ok(generate(
        &s,
        &model,
        &prompt,
        system.as_deref(),
    ))
}

#[tauri::command]
fn workflows_list() -> Result<Vec<workflows::WorkflowItem>, String> {
    workflows::list()
}

#[tauri::command]
fn workflow_run(
    id: String,
    args: serde_json::Value,
) -> Result<workflows::WorkflowRunResult, String> {
    Ok(workflows::run(&id, args))
}

#[tauri::command]
fn workbooks_list() -> Result<Vec<workbooks::WorkbookItem>, String> {
    workbooks::list()
}

#[tauri::command]
fn workbook_read(name: String) -> Result<String, String> {
    workbooks::read_file(&name)
}

#[tauri::command]
fn indexer_status() -> Result<IndexerStatus, String> {
    Ok(indexer_stub::status())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            let _ = ensure_raster_tree().map_err(|e| format!("data dirs: {e}"))?;
            let path = data_db_path().ok_or("could not resolve app data directory")?;
            let db = Database::open(path).map_err(|e| format!("open database: {e}"))?;
            app.manage(AppState {
                pty: Arc::new(PtyManager::new()),
                db: Mutex::new(db),
                settings: Arc::new(SettingsState::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_close,
            blocks_recent,
            workspace_info,
            git_branch,
            git_status,
            list_dir,
            block_submit_command,
            get_settings,
            update_settings,
            ollama_list_models,
            ollama_generate,
            workflows_list,
            workflow_run,
            workbooks_list,
            workbook_read,
            indexer_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}