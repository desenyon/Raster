mod pty;

use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};

use pty::PtyManager;
use raster_core::{Block, Database};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub cwd: String,
}

pub struct AppState {
    pub pty: Arc<PtyManager>,
    pub db: Mutex<Database>,
}

fn data_db_path() -> Option<PathBuf> {
    Some(dirs::data_dir()?.join("Raster").join("state.db"))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            let path = data_db_path().ok_or("could not resolve app data directory")?;
            let db = Database::open(path).map_err(|e| format!("open database: {e}"))?;
            app.manage(AppState {
                pty: Arc::new(PtyManager::new()),
                db: Mutex::new(db),
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
            git_branch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
