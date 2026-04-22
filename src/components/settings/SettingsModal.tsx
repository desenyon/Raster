import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type AppSettings = {
  ollamaBaseUrl: string;
  ollamaDefaultModel: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [ollamaDefaultModel, setOllamaDefaultModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const s = await invoke<AppSettings>("get_settings");
      setOllamaBaseUrl(s.ollamaBaseUrl);
      setOllamaDefaultModel(s.ollamaDefaultModel);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      await invoke<AppSettings>("update_settings", {
        ollamaBaseUrl: ollamaBaseUrl.trim() || null,
        ollamaDefaultModel: ollamaDefaultModel.trim() || null,
      });
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }, [ollamaBaseUrl, ollamaDefaultModel, onClose]);

  if (!open) return null;

  return (
    <div className="rs-modal-root" role="dialog" aria-modal="true" aria-labelledby="rs-settings-title">
      <button type="button" className="rs-modal-scrim" aria-label="Close settings" onClick={onClose} />
      <div className="rs-modal-panel">
        <div className="rs-modal-head">
          <div>
            <div id="rs-settings-title" className="rs-modal-title">
              Settings
            </div>
            <div className="rs-modal-sub">Local preferences (stored under Raster app data)</div>
          </div>
          <button type="button" className="rs-icon-btn" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="rs-modal-body">
          {err ? <p className="rs-muted" style={{ margin: "0 0 8px" }}>{err}</p> : null}
          <label className="rs-field">
            <span className="rs-field-label">Ollama base URL</span>
            <input
              className="rs-input"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              autoComplete="off"
            />
          </label>
          <label className="rs-field">
            <span className="rs-field-label">Default model (optional)</span>
            <input
              className="rs-input"
              value={ollamaDefaultModel}
              onChange={(e) => setOllamaDefaultModel(e.target.value)}
              placeholder="e.g. llama3.2"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="rs-modal-foot">
          <button type="button" className="rs-btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="rs-btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
