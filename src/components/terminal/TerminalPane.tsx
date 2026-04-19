import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

type PtyOutputPayload = {
  session_id: string;
  data_b64: string;
};

function b64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export type TerminalPaneProps = {
  tabId: string;
  active: boolean;
  onSession: (sessionId: string) => void;
  onExit: () => void;
  onError: (message: string) => void;
};

export function TerminalPane({ tabId, active, onSession, onExit, onError }: TerminalPaneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, SF Mono, ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 1.22,
      scrollback: 10_000,
      theme: {
        background: "#12151c",
        foreground: "#e8ecf2",
        cursor: "#4da3ff",
        cursorAccent: "#09090b",
        selectionBackground: "rgba(77, 163, 255, 0.28)",
        black: "#09090b",
        red: "#ff5f57",
        green: "#34c759",
        yellow: "#f5c451",
        blue: "#4da3ff",
        magenta: "#ff9f0a",
        cyan: "#64d2ff",
        white: "#f5f7fa",
        brightBlack: "#5b6370",
        brightRed: "#ff6b6b",
        brightGreen: "#2fbf71",
        brightYellow: "#f5c451",
        brightBlue: "#78b8ff",
        brightMagenta: "#ff9f0a",
        brightCyan: "#64d2ff",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termRef.current = term;
    fitRef.current = fit;

    const unlisteners: UnlistenFn[] = [];
    let cancelled = false;

    void (async () => {
      try {
        const u1 = await listen<PtyOutputPayload>("pty-output", (ev) => {
          const sid = sessionRef.current;
          if (!sid || ev.payload.session_id !== sid) return;
          term.write(b64ToUint8Array(ev.payload.data_b64));
        });
        unlisteners.push(u1);

        const u2 = await listen<{ session_id: string }>("pty-exit", (ev) => {
          if (ev.payload.session_id === sessionRef.current) {
            onExit();
          }
        });
        unlisteners.push(u2);

        fit.fit();
        const id = await invoke<string>("pty_spawn", {
          cols: term.cols,
          rows: term.rows,
        });
        if (cancelled) {
          void invoke("pty_close", { sessionId: id }).catch(() => {});
          return;
        }
        sessionRef.current = id;
        onSession(id);
        term.onData((data) => {
          void invoke("pty_write", {
            sessionId: id,
            data: Array.from(new TextEncoder().encode(data)),
          }).catch(() => {});
        });
      } catch (e) {
        onError(`Failed to start PTY: ${String(e)}`);
      }
    })();

    const ro = new ResizeObserver(() => {
      fit.fit();
      const sid = sessionRef.current;
      const t = termRef.current;
      if (sid && t) {
        void invoke("pty_resize", {
          sessionId: sid,
          cols: t.cols,
          rows: t.rows,
        }).catch(() => {});
      }
    });
    const wrap = wrapRef.current;
    if (wrap) ro.observe(wrap);

    return () => {
      cancelled = true;
      ro.disconnect();
      for (const u of unlisteners) u();
      const sid = sessionRef.current;
      sessionRef.current = null;
      if (sid) void invoke("pty_close", { sessionId: sid }).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [tabId, onSession, onExit, onError]);

  useEffect(() => {
    if (!active) return;
    const t = termRef.current;
    const fit = fitRef.current;
    const sid = sessionRef.current;
    if (!t || !fit) return;
    requestAnimationFrame(() => {
      fit.fit();
      if (sid) {
        void invoke("pty_resize", {
          sessionId: sid,
          cols: t.cols,
          rows: t.rows,
        }).catch(() => {});
      }
      t.focus();
    });
  }, [active]);

  return (
    <div ref={wrapRef} className={`rs-terminal-layer ${active ? "rs-terminal-layer-active" : ""}`} data-tab={tabId}>
      <div ref={containerRef} className="rs-terminal-xterm" />
    </div>
  );
}
