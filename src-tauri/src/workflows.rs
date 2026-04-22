use std::fs;
use std::path::Path;
use std::process::Command;

use serde::Serialize;
use toml::Value;

use crate::paths::workflows_dir;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub file_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunResult {
    pub ok: bool,
    pub error: Option<String>,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Parse `name` from a workflow TOML; fallback to file stem.
fn parse_name(toml: &str, file_stem: &str) -> (String, String) {
    let v: Value = match toml.parse() {
        Ok(x) => x,
        Err(_) => {
            return (file_stem.to_string(), String::new());
        }
    };
    let name = v
        .get("name")
        .and_then(|x| x.as_str())
        .unwrap_or(file_stem)
        .to_string();
    let desc = v
        .get("description")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    (name, desc)
}

fn extract_command(toml: &str) -> Option<String> {
    let v: Value = toml.parse().ok()?;
    v.get("command")?.as_str().map(String::from)
}

/// `{{name}}` replaced from `args` JSON object (string values).
fn apply_args(cmd: &str, args: &serde_json::Value) -> String {
    let mut s = cmd.to_string();
    if let serde_json::Value::Object(map) = args {
        for (k, v) in map {
            let pat = format!("{{{{{k}}}}}");
            let rep = v.as_str().map(|x| x.to_string()).unwrap_or_default();
            s = s.replace(&pat, &rep);
        }
    }
    s
}

pub fn list() -> Result<Vec<WorkflowItem>, String> {
    let dir = workflows_dir().ok_or("workflows path missing")?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = vec![];
    for e in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let p = e.path();
        if p.extension().and_then(|s| s.to_str()) != Some("toml") {
            continue;
        }
        let file_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let id = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let toml = fs::read_to_string(&p).unwrap_or_default();
        let (name, description) = parse_name(&toml, &id);
        out.push(WorkflowItem {
            id,
            name,
            description,
            file_name,
        });
    }
    out.sort_by(|a, a2| a.name.cmp(&a2.name));
    Ok(out)
}

pub fn run(id: &str, args: serde_json::Value) -> WorkflowRunResult {
    let dir = match workflows_dir() {
        Some(d) => d,
        None => {
            return WorkflowRunResult {
                ok: false,
                error: Some("workflows path missing".into()),
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
            };
        }
    };
    let path = dir.join(format!("{id}.toml"));
    if !Path::new(&path).exists() {
        return WorkflowRunResult {
            ok: false,
            error: Some("workflow not found".into()),
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
        };
    }
    let toml = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) => {
            return WorkflowRunResult {
                ok: false,
                error: Some(e.to_string()),
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
            };
        }
    };
    let Some(cmd) = extract_command(&toml) else {
        return WorkflowRunResult {
            ok: false,
            error: Some("missing command key in TOML".into()),
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
        };
    };
    let cmd = apply_args(&cmd, &args);
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/"));
    let o = Command::new("/bin/sh")
        .arg("-c")
        .arg(&cmd)
        .current_dir(&cwd)
        .output();
    match o {
        Ok(out) => {
            let code = out.status.code();
            WorkflowRunResult {
                ok: out.status.success(),
                error: if out.status.success() {
                    None
                } else {
                    Some("command failed".into())
                },
                exit_code: code,
                stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
            }
        }
        Err(e) => WorkflowRunResult {
            ok: false,
            error: Some(e.to_string()),
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
        },
    }
}
