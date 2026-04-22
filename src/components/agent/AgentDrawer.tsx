import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../settings/SettingsModal";

type Props = {
  onClose: () => void;
};

type OllamaModel = { name: string; size: number | null };
type OllamaList = { ok: boolean; error: string | null; models: OllamaModel[] };
type GenRes = { ok: boolean; error: string | null; response: string | null };

type ChatMessage = { role: "user" | "assistant"; text: string };

/**
 * Local Ollama chat — wiring for agent mission control in PROMPT.md.
 */
export function AgentDrawer({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  const loadModelsAndSettings = useCallback(async () => {
    setListErr(null);
    setGenErr(null);
    let s: AppSettings | null = null;
    try {
      s = await invoke<AppSettings>("get_settings");
      setSettings(s);
    } catch (e) {
      setListErr(String(e));
    }
    try {
      const m = await invoke<OllamaList>("ollama_list_models");
      if (m.ok) {
        setModels(m.models);
        setModel((prev) => {
          if (prev) return prev;
          const d = s?.ollamaDefaultModel;
          if (d && m.models.some((x) => x.name === d)) return d;
          return m.models[0]?.name ?? "";
        });
      } else {
        setListErr(m.error ?? "Could not list models");
      }
    } catch (e) {
      setListErr(String(e));
    }
  }, []);

  useEffect(() => {
    void loadModelsAndSettings();
  }, [loadModelsAndSettings]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !model) return;
    setInput("");
    setGenErr(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await invoke<GenRes>("ollama_generate", { model, prompt: text, system: null });
      if (r.ok) {
        setMessages((m) => [...m, { role: "assistant", text: r.response?.trim() || "(no text)" }]);
      } else {
        setGenErr(r.error ?? "Generate failed");
        setMessages((m) => [
          ...m,
          { role: "assistant", text: r.error ? `Error: ${r.error}` : "Request failed" },
        ]);
      }
    } catch (e) {
      const msg = String(e);
      setGenErr(msg);
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }, [input, model]);

  return (
    <aside className="rs-agent" aria-label="Agent">
      <div className="rs-agent-head">
        <div>
          <div className="rs-agent-title">Agent</div>
          <div className="rs-agent-sub">Ollama — local, no network routing</div>
        </div>
        <button type="button" className="rs-icon-btn" title="Close" onClick={onClose} data-tauri-drag-region="false">
          <X size={16} />
        </button>
      </div>
      <div className="rs-agent-body">
        <div className="rs-agent-row">
          <label className="rs-agent-label" htmlFor="ollama-model">
            Model
          </label>
          <select
            id="ollama-model"
            className="rs-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={busy}
          >
            <option value="">— pick model —</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {listErr || genErr ? (
          <p className="rs-muted" style={{ fontSize: 11, margin: 0 }}>
            {listErr ?? genErr}
          </p>
        ) : null}
        {settings ? (
          <p className="rs-muted" style={{ fontSize: 10, margin: 0 }}>
            Endpoint {settings.ollamaBaseUrl}
          </p>
        ) : null}
        <div className="rs-agent-chat" aria-live="polite">
          {messages.length === 0 ? (
            <p className="rs-muted" style={{ fontSize: 12 }}>
              Message Ollama from your workspace. Tool runs and plans will connect here in a later pass.
            </p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "rs-agent-msg rs-agent-msg-user" : "rs-agent-msg"}>
                <div className="rs-agent-msg-role">{m.role === "user" ? "You" : "Model"}</div>
                <div className="rs-agent-msg-text mono">{m.text}</div>
              </div>
            ))
          )}
        </div>
        <div className="rs-agent-compose">
          <textarea
            className="rs-agent-input"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask something…  (⌘↵ to send)"
            disabled={busy}
          />
          <div className="rs-agent-actions">
            <button type="button" className="rs-btn-ghost" onClick={() => void loadModelsAndSettings()} disabled={busy}>
              Refresh models
            </button>
            <button type="button" className="rs-btn-primary" onClick={() => void send()} disabled={busy || !model || !input.trim()}>
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
        <section className="rs-agent-card">
          <h3 className="rs-agent-h3">Objectives & tools (stub)</h3>
          <p className="rs-muted">Visible plans, shell/read/edit with approvals, and block context from PROMPT.md are not wired in this build.</p>
        </section>
      </div>
    </aside>
  );
}
