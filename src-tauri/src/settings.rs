use std::fs;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::paths::raster_data_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Base URL for Ollama, e.g. `http://127.0.0.1:11434`
    pub ollama_base_url: String,
    /// Default model for agent chat; empty = user must pick
    pub ollama_default_model: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            ollama_base_url: "http://127.0.0.1:11434".to_string(),
            ollama_default_model: String::new(),
        }
    }
}

fn settings_path() -> Option<std::path::PathBuf> {
    Some(raster_data_dir()?.join("settings.json"))
}

pub fn load_settings_from_disk() -> AppSettings {
    let Some(p) = settings_path() else {
        return AppSettings::default();
    };
    if !p.exists() {
        return AppSettings::default();
    }
    let data = match fs::read_to_string(&p) {
        Ok(s) => s,
        Err(_) => return AppSettings::default(),
    };
    serde_json::from_str(&data).unwrap_or_default()
}

pub fn save_settings_to_disk(settings: &AppSettings) -> Result<(), String> {
    let Some(p) = settings_path() else {
        return Err("no settings path".to_string());
    };
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let s = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&p, s).map_err(|e| e.to_string())?;
    Ok(())
}

pub struct SettingsState {
    pub inner: Mutex<AppSettings>,
}

impl SettingsState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(load_settings_from_disk()),
        }
    }
}
