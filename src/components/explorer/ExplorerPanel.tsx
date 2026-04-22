import { invoke } from "@tauri-apps/api/core";
import { ChevronUp, FolderGit2, Play, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type BlockRow = {
  id: string;
  session_id: string;
  command_text: string;
  cwd: string;
  started_at: string;
  ended_at: string | null;
  status: unknown;
  stdout_preview: string;
  stderr_preview: string;
};

export type GitFileEntry = {
  path: string;
  index: string;
  worktree: string;
};

export type GitStatusInfo = {
  branch: string | null;
  clean: boolean;
  inRepo: boolean;
  files: GitFileEntry[];
};

export type FsEntry = { name: string; isDir: boolean };

export type ListDirResult = {
  relPath: string;
  parent: string | null;
  entries: FsEntry[];
};

type WorkflowItem = { id: string; name: string; description: string; fileName: string };
type WorkflowRunResult = { ok: boolean; error: string | null; exitCode: number | null; stdout: string; stderr: string };
type WorkbookItem = { name: string; fileName: string };
type IndexerStatus = { state: string; message: string; fileCount: number };

type Props = {
  view: "files" | "search" | "git";
  blocks: BlockRow[];
  onRefreshBlocks: () => void;
  git: GitStatusInfo | null;
  onRefreshGit: () => void;
  listDir: (subPath?: string | null) => Promise<ListDirResult>;
};

function childRelPath(cwd: string, name: string) {
  return cwd ? `${cwd.replace(/\/$/, "")}/${name}` : name;
}

export function ExplorerPanel({ view, blocks, onRefreshBlocks, git, onRefreshGit, listDir }: Props) {
  const [dir, setDir] = useState<ListDirResult | null>(null);
  const [dirPath, setDirPath] = useState("");
  const [dirError, setDirError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [workbooks, setWorkbooks] = useState<WorkbookItem[]>([]);
  const [wfErr, setWfErr] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<WorkflowRunResult | null>(null);
  const [indexer, setIndexer] = useState<IndexerStatus | null>(null);
  const [workbookText, setWorkbookText] = useState<{ title: string; body: string } | null>(null);

  const loadDir = useCallback(
    async (sub: string) => {
      setDirError(null);
      try {
        const r = await listDir(sub.length === 0 ? null : sub);
        setDir(r);
        setDirPath(r.relPath);
      } catch (err) {
        setDir(null);
        setDirError(String(err));
      }
    },
    [listDir],
  );

  useEffect(() => {
    if (view === "files") void loadDir(dirPath);
  }, [view]);

  const openChild = (name: string, isDir: boolean) => {
    if (!isDir) return;
    const next = childRelPath(dirPath, name);
    void loadDir(next);
  };

  const goUp = () => {
    if (!dir) return;
    if (dir.parent == null) return;
    void loadDir(dir.parent);
  };

  const loadSideData = useCallback(async () => {
    setWfErr(null);
    try {
      const [w, b] = await Promise.all([
        invoke<WorkflowItem[]>("workflows_list"),
        invoke<WorkbookItem[]>("workbooks_list"),
      ]);
      setWorkflows(w);
      setWorkbooks(b);
    } catch (e) {
      setWfErr(String(e));
    }
  }, []);

  useEffect(() => {
    if (view === "files") void loadSideData();
  }, [view, loadSideData]);

  const loadSearchMeta = useCallback(async () => {
    try {
      const s = await invoke<IndexerStatus>("indexer_status");
      setIndexer(s);
    } catch {
      setIndexer(null);
    }
  }, []);

  useEffect(() => {
    if (view === "search") void loadSearchMeta();
  }, [view, loadSearchMeta]);

  const runWorkflow = async (id: string) => {
    setLastRun(null);
    try {
      const r = await invoke<WorkflowRunResult>("workflow_run", { id, args: {} });
      setLastRun(r);
    } catch (e) {
      setLastRun({ ok: false, error: String(e), exitCode: null, stdout: "", stderr: "" });
    }
  };

  const openWorkbook = async (fileName: string, title: string) => {
    try {
      const body = await invoke<string>("workbook_read", { name: fileName });
      setWorkbookText({ title, body });
    } catch (e) {
      setWorkbookText({ title, body: `Error: ${String(e)}` });
    }
  };

  if (view === "search") {
    return (
      <div className="rs-explorer">
        <div className="rs-explorer-head">
          <Search size={14} aria-hidden />
          <span>Search</span>
        </div>
        <div className="rs-explorer-body">
          {indexer ? (
            <div className="rs-indexer-card">
              <div className="rs-indexer-row">
                <span className="rs-muted">Indexer</span>
                <span className="rs-pill mono">{indexer.state}</span>
              </div>
              <p className="rs-muted" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.45 }}>
                {indexer.message}
              </p>
              <p className="rs-muted" style={{ margin: "6px 0 0", fontSize: 11 }}>
                Tracked files (placeholder): {indexer.fileCount}
              </p>
            </div>
          ) : (
            <p className="rs-muted">Could not read indexer status.</p>
          )}
          <p className="rs-muted" style={{ marginTop: 12 }}>Symbol and full-text search will use the Tantivy index from PROMPT.md.</p>
          <div className="rs-search-fake" style={{ marginTop: 10 }}>
            <Search size={14} className="rs-search-fake-icon" aria-hidden />
            <span>Search symbols, blocks, and files…</span>
          </div>
        </div>
      </div>
    );
  }

  if (view === "git") {
    return (
      <div className="rs-explorer">
        <div className="rs-explorer-head">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderGit2 size={14} aria-hidden />
            <span>Source control</span>
          </div>
          <button type="button" className="rs-icon-btn" title="Refresh git status" onClick={() => onRefreshGit()}>
            <RefreshCw size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="rs-explorer-body" style={{ padding: "0 0 10px" }}>
          {!git?.inRepo ? (
            <p className="rs-muted">Not a git repository. Open a repo root to see changes.</p>
          ) : (
            <>
              <div className="rs-git-bar">
                <span className="rs-git-branch mono">{git.branch ?? "—"}</span>
                {git.clean ? <span className="rs-git-clean">clean</span> : <span className="rs-git-dirty">dirty</span>}
              </div>
              {git.files.length === 0 ? (
                <p className="rs-muted" style={{ padding: "0 12px" }}>
                  No file changes. Committed state matches the work tree.
                </p>
              ) : (
                <ul className="rs-git-list">
                  {git.files.map((f) => (
                    <li key={f.path} className="rs-git-row" title={f.path}>
                      <span className="rs-git-flags mono">
                        {f.index}
                        {f.worktree}
                      </span>
                      <span className="rs-git-path mono">{f.path}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rs-explorer">
      {workbookText ? (
        <div className="rs-modal-root" role="dialog" aria-modal="true" aria-label="Workbook">
          <button type="button" className="rs-modal-scrim" aria-label="Close workbook" onClick={() => setWorkbookText(null)} />
          <div className="rs-modal-panel rs-workbook-panel">
            <div className="rs-modal-head">
              <div className="rs-workbook-title mono">{workbookText.title}</div>
              <button type="button" className="rs-icon-btn" title="Close" onClick={() => setWorkbookText(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="rs-workbook-body">
              <pre className="rs-workbook-pre">{workbookText.body}</pre>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rs-explorer-head">
        <span>Explorer</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" className="rs-icon-btn" title="Up one folder" onClick={() => goUp()} disabled={!dir || dir.parent == null}>
            <ChevronUp size={14} strokeWidth={2} />
          </button>
          <button type="button" className="rs-icon-btn" title="Refresh folder" onClick={() => void loadDir(dirPath)}>
            <RefreshCw size={14} strokeWidth={2} />
          </button>
          <button type="button" className="rs-icon-btn" title="Refresh blocks" onClick={() => onRefreshBlocks()}>
            <RefreshCw size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="rs-explorer-section">
        <div className="rs-explorer-section-title">Workspace</div>
        <div className="rs-breadcrumb mono" title={dirPath || "/"}>
          {dirPath ? dirPath : "/"}
        </div>
        <div className="rs-tree-list">
          {dirError ? (
            <p className="rs-muted rs-explorer-empty">{dirError}</p>
          ) : !dir || dir.entries.length === 0 ? (
            <p className="rs-muted rs-explorer-empty">Empty directory.</p>
          ) : (
            dir.entries.map((e) => (
              <button
                key={e.name}
                type="button"
                className={`rs-tree-row ${e.isDir ? "rs-tree-row-dir" : ""}`}
                title={e.name}
                onClick={() => openChild(e.name, e.isDir)}
                disabled={!e.isDir}
              >
                <span className="rs-tree-ico">{e.isDir ? "▸" : " "}</span>
                <span className="mono">{e.isDir ? `${e.name}/` : e.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="rs-explorer-section">
        <div className="rs-explorer-section-title">Workflows (app data)</div>
        {wfErr ? <p className="rs-muted rs-explorer-empty">{wfErr}</p> : null}
        {workflows.length === 0 && !wfErr ? (
          <p className="rs-muted rs-explorer-empty" style={{ fontSize: 11 }}>
            Add .toml files under Application Support / Raster / workflows
          </p>
        ) : (
          <ul className="rs-workflow-list">
            {workflows.map((w) => (
              <li key={w.id} className="rs-workflow-row">
                <div className="rs-workflow-meta">
                  <span className="mono rs-workflow-name">{w.name}</span>
                  {w.description ? <span className="rs-muted" style={{ fontSize: 10 }}>{w.description}</span> : null}
                </div>
                <button type="button" className="rs-icon-btn" title="Run workflow" onClick={() => void runWorkflow(w.id)}>
                  <Play size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {lastRun ? (
          <pre className="rs-workflow-out mono" title="Last run output">
            {lastRun.ok ? "ok" : "failed"}
            {lastRun.error ? ` — ${lastRun.error}` : ""}
            {lastRun.stdout ? `\n${lastRun.stdout}` : ""}
            {lastRun.stderr ? `\n${lastRun.stderr}` : ""}
          </pre>
        ) : null}
      </div>
      <div className="rs-explorer-section">
        <div className="rs-explorer-section-title">Workbooks</div>
        {workbooks.length === 0 ? (
          <p className="rs-muted rs-explorer-empty" style={{ fontSize: 11 }}>
            Add .md files under …/ Raster / workbooks
          </p>
        ) : (
          <ul className="rs-wb-list">
            {workbooks.map((b) => (
              <li key={b.name}>
                <button type="button" className="rs-wb-link" onClick={() => void openWorkbook(b.fileName, b.name)}>
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rs-explorer-section">
        <div className="rs-explorer-section-title">Recent blocks</div>
        <div className="rs-explorer-list">
          {blocks.length === 0 ? (
            <p className="rs-muted rs-explorer-empty">Run a command in the terminal and press Enter to log a block.</p>
          ) : (
            blocks.map((b) => (
              <button key={b.id} type="button" className="rs-block-row" title={b.cwd}>
                <span className="rs-block-cmd mono">{b.command_text || "(empty)"}</span>
                <span className="rs-block-meta">{b.cwd}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
