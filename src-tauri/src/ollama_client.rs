use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

use crate::settings::AppSettings;

#[derive(Debug, Deserialize, Serialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaListResult {
    pub ok: bool,
    pub error: Option<String>,
    pub models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct TagsModel {
    name: String,
    size: Option<u64>,
}

#[derive(Deserialize)]
struct TagsResponse {
    models: Vec<TagsModel>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaGenerateResult {
    pub ok: bool,
    pub error: Option<String>,
    pub response: Option<String>,
}

#[derive(Serialize)]
struct GenReq {
    model: String,
    prompt: String,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
}

#[derive(Deserialize)]
struct GenResp {
    response: String,
}

fn client() -> Client {
    Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("reqwest client")
}

/// GET /api/tags
pub fn list_models(settings: &AppSettings) -> OllamaListResult {
    let base = settings.ollama_base_url.trim_end_matches('/');
    let url = format!("{base}/api/tags");
    let r = client().get(&url).send();
    match r {
        Ok(resp) if resp.status().is_success() => {
            let t: std::result::Result<TagsResponse, _> = resp.json();
            match t {
                Ok(body) => OllamaListResult {
                    ok: true,
                    error: None,
                    models: body
                        .models
                        .into_iter()
                        .map(|m| OllamaModel {
                            name: m.name,
                            size: m.size,
                        })
                        .collect(),
                },
                Err(e) => OllamaListResult {
                    ok: false,
                    error: Some(format!("parse: {e}")),
                    models: vec![],
                },
            }
        }
        Ok(resp) => OllamaListResult {
            ok: false,
            error: Some(format!("HTTP {}", resp.status())),
            models: vec![],
        },
        Err(e) => OllamaListResult {
            ok: false,
            error: Some(e.to_string()),
            models: vec![],
        },
    }
}

/// Non-streaming generate.
pub fn generate(
    settings: &AppSettings,
    model: &str,
    prompt: &str,
    system: Option<&str>,
) -> OllamaGenerateResult {
    let base = settings.ollama_base_url.trim_end_matches('/');
    let url = format!("{base}/api/generate");
    let body = GenReq {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: false,
        system: system.map(String::from),
    };
    let r = client()
        .post(&url)
        .json(&body)
        .send();
    match r {
        Ok(resp) if resp.status().is_success() => {
            let t: std::result::Result<GenResp, _> = resp.json();
            match t {
                Ok(g) => OllamaGenerateResult {
                    ok: true,
                    error: None,
                    response: Some(g.response),
                },
                Err(e) => OllamaGenerateResult {
                    ok: false,
                    error: Some(format!("parse: {e}")),
                    response: None,
                },
            }
        }
        Ok(resp) => OllamaGenerateResult {
            ok: false,
            error: Some(format!("HTTP {}", resp.status())),
            response: None,
        },
        Err(e) => OllamaGenerateResult {
            ok: false,
            error: Some(e.to_string()),
            response: None,
        },
    }
}

/// Quick check that the base responds.
#[allow(dead_code)]
pub fn health(settings: &AppSettings) -> bool {
    let base = settings.ollama_base_url.trim_end_matches('/');
    let url = format!("{base}/api/tags");
    client()
        .get(&url)
        .send()
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}
