use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone, Serialize)]
struct PtyOutputPayload {
    session_id: String,
    /// Raw PTY bytes (UTF-8 terminal stream), base64 for safe JSON transit.
    data_b64: String,
}

pub struct PtyManager {
    inner: Mutex<HashMap<String, PtySession>>,
}

struct PtySession {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn spawn(&self, app: &AppHandle, cwd: PathBuf, cols: u16, rows: u16) -> Result<String, String> {
        let shell_str = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new(&shell_str);
        cmd.cwd(&cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("spawn_command: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone_reader: {e}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take_writer: {e}"))?;

        let master = pair.master;

        let id = Uuid::new_v4().to_string();
        let session_id = id.clone();
        let app_handle = app.clone();
        let child = Arc::new(Mutex::new(child));
        let child_for_wait = child.clone();

        std::thread::spawn(move || {
            let mut buf = [0u8; 16 * 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let payload = PtyOutputPayload {
                            session_id: session_id.clone(),
                            data_b64: B64.encode(&buf[..n]),
                        };
                        let _ = app_handle.emit("pty-output", payload);
                    }
                    Err(_) => break,
                }
            }
            if let Ok(mut c) = child_for_wait.lock() {
                let _ = c.wait();
            }
            let _ = app_handle.emit(
                "pty-exit",
                serde_json::json!({ "session_id": session_id }),
            );
        });

        let session = PtySession {
            master: Mutex::new(master),
            writer: Mutex::new(writer),
            child,
        };

        self.inner
            .lock()
            .map_err(|_| "pty mutex poisoned".to_string())?
            .insert(id.clone(), session);

        Ok(id)
    }

    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let map = self.inner.lock().map_err(|_| "pty mutex poisoned")?;
        let s = map.get(session_id).ok_or_else(|| "unknown session".to_string())?;
        let mut w = s.writer.lock().map_err(|_| "writer mutex poisoned")?;
        w.write_all(data).map_err(|e| e.to_string())?;
        w.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let map = self.inner.lock().map_err(|_| "pty mutex poisoned")?;
        let s = map.get(session_id).ok_or_else(|| "unknown session".to_string())?;
        let master = s.master.lock().map_err(|_| "master mutex poisoned")?;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let mut map = self.inner.lock().map_err(|_| "pty mutex poisoned")?;
        if let Some(s) = map.remove(session_id) {
            if let Ok(mut child) = s.child.lock() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        Ok(())
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}
