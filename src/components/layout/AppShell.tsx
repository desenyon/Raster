import { invoke } from "@tauri-apps/api/core";
import { FolderSearch, GitBranch, LayoutGrid, PanelLeftClose, PanelLeft, Settings2, SquareTerminal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette, type PaletteAction } from "../palette/CommandPalette";
import { ExplorerPanel, type BlockRow } from "../explorer/ExplorerPanel";
import { TerminalWorkspace } from "../terminal/TerminalWorkspace";

type WorkspaceInfo = { cwd: string };

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [activity, setActivity] = useState<"files" | "search" | "git">("files");
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [cwd, setCwd] = useState<string>("");
  const [branch, setBranch] = useState<string | null>(null);
  const addTabRef = useRef<(() => void) | null>(null);

  const refreshBlocks = useCallback(async () => {
    try {
      const rows = await invoke<BlockRow[]>("blocks_recent", { limit: 24 });
      setBlocks(rows);
    } catch {
      setBlocks([]);
    }
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const w = await invoke<WorkspaceInfo>("workspace_info");
      setCwd(w.cwd);
    } catch {
      setCwd("");
    }
    try {
      const b = await invoke<string | null>("git_branch");
      setBranch(b);
    } catch {
      setBranch(null);
    }
  }, []);

  useEffect(() => {
    void refreshBlocks();
    void refreshMeta();
    const t = window.setInterval(() => void refreshMeta(), 8000);
    return () => window.clearInterval(t);
  }, [refreshBlocks, refreshMeta]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const addTerminalTab = useCallback(() => {
    addTabRef.current?.();
  }, []);

  const paletteActions: PaletteAction[] = useMemo(
    () => [
      {
        id: "palette.close",
        label: "Close command palette",
        hint: "UI",
        keys: "Esc",
        run: closePalette,
      },
      {
        id: "tab.new",
        label: "New terminal tab",
        hint: "Sessions",
        keys: "⌘T",
        run: addTerminalTab,
      },
      {
        id: "view.toggleExplorer",
        label: explorerOpen ? "Hide side panel" : "Show side panel",
        hint: "Layout",
        keys: "⌘B",
        run: () => setExplorerOpen((o) => !o),
      },
      {
        id: "view.activity.files",
        label: "Focus Explorer",
        hint: "Activity",
        run: () => {
          setActivity("files");
          setExplorerOpen(true);
        },
      },
      {
        id: "view.activity.search",
        label: "Focus search",
        hint: "Activity",
        run: () => {
          setActivity("search");
          setExplorerOpen(true);
        },
      },
      {
        id: "view.activity.git",
        label: "Focus source control",
        hint: "Activity",
        run: () => {
          setActivity("git");
          setExplorerOpen(true);
        },
      },
    ],
    [addTerminalTab, closePalette, explorerOpen],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setExplorerOpen((o) => !o);
      }
      if (mod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        addTabRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cwdShort = useMemo(() => {
    if (!cwd) return "";
    const parts = cwd.split("/").filter(Boolean);
    if (parts.length <= 2) return cwd;
    return `…/${parts.slice(-2).join("/")}`;
  }, [cwd]);

  return (
    <div className="rs-app">
      <CommandPalette open={paletteOpen} onClose={closePalette} actions={paletteActions} />

      <nav className="rs-activity" aria-label="Primary">
        <button
          type="button"
          className={`rs-activity-btn ${activity === "files" ? "rs-activity-btn-on" : ""}`}
          title="Explorer"
          onClick={() => {
            setActivity("files");
            setExplorerOpen(true);
          }}
        >
          <LayoutGrid size={20} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`rs-activity-btn ${activity === "search" ? "rs-activity-btn-on" : ""}`}
          title="Search"
          onClick={() => {
            setActivity("search");
            setExplorerOpen(true);
          }}
        >
          <FolderSearch size={20} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`rs-activity-btn ${activity === "git" ? "rs-activity-btn-on" : ""}`}
          title="Source control"
          onClick={() => {
            setActivity("git");
            setExplorerOpen(true);
          }}
        >
          <GitBranch size={20} strokeWidth={1.75} />
        </button>
        <div className="rs-activity-spacer" />
        <button type="button" className="rs-activity-btn" title="Terminal (this workspace)">
          <SquareTerminal size={20} strokeWidth={1.75} />
        </button>
        <button type="button" className="rs-activity-btn" title="Settings (soon)">
          <Settings2 size={20} strokeWidth={1.75} />
        </button>
      </nav>

      {explorerOpen ? (
        <aside className="rs-side">
          <ExplorerPanel view={activity} blocks={blocks} onRefreshBlocks={refreshBlocks} />
        </aside>
      ) : null}

      <div className="rs-main">
        <header className="rs-topbar" data-tauri-drag-region>
          <div className="rs-topbar-left">
            <button
              type="button"
              className="rs-icon-btn rs-topbar-toggle"
              title={explorerOpen ? "Hide side panel (⌘B)" : "Show side panel (⌘B)"}
              onClick={() => setExplorerOpen((o) => !o)}
              data-tauri-drag-region="false"
            >
              {explorerOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
            <div className="rs-brand">
              <span className="rs-brand-mark" />
              <span className="rs-brand-text">Raster</span>
              <span className="rs-brand-sub">workbench</span>
            </div>
          </div>
          <button type="button" className="rs-palette-trigger" onClick={openPalette} data-tauri-drag-region="false">
            <span className="rs-palette-trigger-placeholder">Search or run command…</span>
            <kbd className="rs-kbd">⌘K</kbd>
          </button>
          <div className="rs-topbar-right" data-tauri-drag-region>
            <span className="rs-chip mono" title={cwd || undefined}>
              {cwdShort || "—"}
            </span>
          </div>
        </header>

        <div className="rs-stage">
          <TerminalWorkspace
            onRegisterAddTab={(fn) => {
              addTabRef.current = fn;
            }}
          />
        </div>

        <footer className="rs-statusbar">
          <div className="rs-status-left">
            <span className="rs-status-item">
              <GitBranch size={12} className="rs-status-ico" aria-hidden />
              <span className="mono">{branch ?? "no git"}</span>
            </span>
            <span className="rs-status-sep" />
            <span className="rs-status-item mono">UTF-8</span>
            <span className="rs-status-sep" />
            <span className="rs-status-item">PTY</span>
          </div>
          <div className="rs-status-right mono">local-first</div>
        </footer>
      </div>
    </div>
  );
}
