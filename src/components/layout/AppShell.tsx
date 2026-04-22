import { invoke } from "@tauri-apps/api/core";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderSearch, GitBranch, LayoutGrid, PanelLeftClose, PanelLeft, Settings2, SquareTerminal } from "lucide-react";
import { AgentDrawer } from "../agent/AgentDrawer";
import { ExplorerPanel, type BlockRow, type ListDirResult, type GitStatusInfo } from "../explorer/ExplorerPanel";
import { SettingsModal } from "../settings/SettingsModal";
import { PtySessionPane } from "../terminal/PtySessionPane";
import { TerminalWorkspace } from "../terminal/TerminalWorkspace";
import type { PaletteAction } from "../palette/CommandPalette";

const CommandPalette = lazy(() =>
  import("../palette/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);

type WorkspaceInfo = { cwd: string };

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [activity, setActivity] = useState<"files" | "search" | "git">("files");
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [git, setGit] = useState<GitStatusInfo | null>(null);
  const [cwd, setCwd] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const addTabRef = useRef<(() => void) | null>(null);

  const listDir = useCallback(async (subPath?: string | null) => {
    return await invoke<ListDirResult>("list_dir", { subPath: subPath === undefined || subPath === null ? null : subPath });
  }, []);

  const refreshBlocks = useCallback(async () => {
    try {
      const rows = await invoke<BlockRow[]>("blocks_recent", { limit: 32 });
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
  }, []);

  const refreshGit = useCallback(async () => {
    try {
      const s = await invoke<GitStatusInfo>("git_status");
      setGit(s);
    } catch {
      setGit(null);
    }
  }, []);

  useEffect(() => {
    void refreshBlocks();
    void refreshMeta();
    void refreshGit();
    const t = window.setInterval(() => {
      void refreshMeta();
      void refreshGit();
    }, 10_000);
    return () => window.clearInterval(t);
  }, [refreshBlocks, refreshMeta, refreshGit]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const addTerminalTab = useCallback(() => {
    addTabRef.current?.();
  }, []);

  const branchLabel = git?.inRepo ? (git.branch ?? "detached") : "no git";

  const paletteActions: PaletteAction[] = useMemo(
    () => [
      { id: "palette.close", label: "Close command palette", hint: "UI", keys: "Esc", run: closePalette },
      { id: "tab.new", label: "New terminal tab", hint: "Sessions", keys: "⌘T", run: addTerminalTab },
      {
        id: "view.toggleExplorer",
        label: explorerOpen ? "Hide side panel" : "Show side panel",
        hint: "Layout",
        keys: "⌘B",
        run: () => setExplorerOpen((o) => !o),
      },
      {
        id: "view.toggleAgent",
        label: agentOpen ? "Hide agent panel" : "Show agent panel",
        hint: "Layout",
        keys: "⌘J",
        run: () => setAgentOpen((o) => !o),
      },
      {
        id: "view.split",
        label: splitOn ? "Close split" : "Split terminal (auxiliary shell)",
        hint: "Layout",
        keys: "⌘\\",
        run: () => setSplitOn((o) => !o),
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
    [addTerminalTab, agentOpen, closePalette, explorerOpen, splitOn],
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
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAgentOpen((o) => !o);
      }
      if (mod && (e.key === "\\" || e.code === "Backslash")) {
        e.preventDefault();
        setSplitOn((o) => !o);
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
      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onClose={closePalette} actions={paletteActions} />
      </Suspense>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
        <button
          type="button"
          className={`rs-activity-btn ${agentOpen ? "rs-activity-btn-on" : ""}`}
          title="Agent (⌘J)"
          onClick={() => setAgentOpen((o) => !o)}
        >
          <span className="rs-activity-ga" aria-hidden>
            A
          </span>
        </button>
        <button type="button" className="rs-activity-btn" title="Terminal (this workspace)">
          <SquareTerminal size={20} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="rs-activity-btn"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 size={20} strokeWidth={1.75} />
        </button>
      </nav>

      {explorerOpen ? (
        <aside className="rs-side">
          <ExplorerPanel
            view={activity}
            blocks={blocks}
            onRefreshBlocks={refreshBlocks}
            git={git}
            onRefreshGit={refreshGit}
            listDir={listDir}
          />
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
            {splitOn ? <span className="rs-pill">split</span> : null}
            <span className="rs-chip mono" title={cwd || undefined}>
              {cwdShort || "—"}
            </span>
          </div>
        </header>

        <div className="rs-body">
          <div className="rs-work">
            <div className="rs-stage">
              {splitOn ? (
                <div className="rs-split" data-direction="row">
                  <div className="rs-split-cell">
                    <TerminalWorkspace
                      onRegisterAddTab={(fn) => {
                        addTabRef.current = fn;
                      }}
                      onBlockLogged={refreshBlocks}
                    />
                  </div>
                  <div className="rs-split-cell">
                    <div className="rs-split-hint" title="Second PTY. Close split with ⌘\\ or the palette.">
                      Auxiliary
                    </div>
                    <div className="rs-split-pty">
                      <PtySessionPane
                        paneKey="split-aux"
                        active={true}
                        onSession={() => {}}
                        onExit={() => setSplitOn(false)}
                        onError={() => setSplitOn(false)}
                        onBlockLogged={refreshBlocks}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <TerminalWorkspace
                  onRegisterAddTab={(fn) => {
                    addTabRef.current = fn;
                  }}
                  onBlockLogged={refreshBlocks}
                />
              )}
            </div>
          </div>
          {agentOpen ? <AgentDrawer onClose={() => setAgentOpen(false)} /> : null}
        </div>

        <footer className="rs-statusbar">
          <div className="rs-status-left">
            <span className="rs-status-item">
              <GitBranch size={12} className="rs-status-ico" aria-hidden />
              <span className="mono">{branchLabel}</span>
            </span>
            {git?.inRepo && !git.clean ? <span className="rs-heat">changed</span> : null}
            <span className="rs-status-sep" />
            <span className="rs-status-item mono">UTF-8</span>
            <span className="rs-status-sep" />
            <span className="rs-status-item">PTY</span>
            {agentOpen ? <span className="rs-pill">agent</span> : null}
          </div>
          <div className="rs-status-right mono">local-first</div>
        </footer>
      </div>
    </div>
  );
}
