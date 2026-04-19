import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  keys?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
};

export function CommandPalette({ open, onClose, actions }: Props) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return actions;
    return actions.filter((a) => {
      const hay = `${a.label} ${a.hint ?? ""}`.toLowerCase();
      return hay.includes(t);
    });
  }, [actions, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const run = useCallback(
    (i: number) => {
      const a = filtered[i];
      if (!a) return;
      a.run();
      onClose();
    },
    [filtered, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, Math.max(filtered.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        run(sel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered.length, onClose, run, sel]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(filtered.length - 1, 0)));
  }, [filtered.length, q]);

  if (!open) return null;

  return (
    <div className="rs-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="rs-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="rs-palette-field">
          <Search size={16} strokeWidth={2} className="rs-palette-field-icon" aria-hidden />
          <input
            ref={inputRef}
            className="rs-palette-input"
            placeholder="Run a command or jump…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
          <span className="rs-palette-kbd">
            <CornerDownLeft size={12} />
          </span>
        </div>
        <ul className="rs-palette-list">
          {filtered.length === 0 ? (
            <li className="rs-palette-empty">No matches</li>
          ) : (
            filtered.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`rs-palette-row ${i === sel ? "rs-palette-row-active" : ""}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(i)}
                >
                  <span className="rs-palette-row-label">{a.label}</span>
                  <span className="rs-palette-row-meta">
                    {a.keys ? <kbd className="rs-kbd">{a.keys}</kbd> : null}
                    {a.hint ? <span className="rs-palette-hint">{a.hint}</span> : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
