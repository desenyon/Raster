import { FolderGit2, RefreshCw, Search } from "lucide-react";

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

type Props = {
  view: "files" | "search" | "git";
  blocks: BlockRow[];
  onRefreshBlocks: () => void;
};

export function ExplorerPanel({ view, blocks, onRefreshBlocks }: Props) {
  if (view === "search") {
    return (
      <div className="rs-explorer">
        <div className="rs-explorer-head">
          <Search size={14} aria-hidden />
          <span>Search</span>
        </div>
        <div className="rs-explorer-body">
          <p className="rs-muted">Workspace and block search will plug into the local index (Tantivy) from PROMPT.md.</p>
          <div className="rs-search-fake">
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
          <FolderGit2 size={14} aria-hidden />
          <span>Source control</span>
        </div>
        <div className="rs-explorer-body">
          <p className="rs-muted">Git status, worktrees, and diff review will live here next to the terminal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rs-explorer">
      <div className="rs-explorer-head">
        <span>Explorer</span>
        <button type="button" className="rs-icon-btn" title="Refresh blocks" onClick={() => onRefreshBlocks()}>
          <RefreshCw size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="rs-explorer-section">
        <div className="rs-explorer-section-title">Workspace</div>
        <div className="rs-tree-placeholder">
          <div className="rs-tree-row">src/</div>
          <div className="rs-tree-row rs-tree-indent">components/</div>
          <div className="rs-tree-row rs-tree-indent">terminal/</div>
          <div className="rs-tree-note">Live file tree will bind to the workspace root.</div>
        </div>
      </div>
      <div className="rs-explorer-section">
        <div className="rs-explorer-section-title">Recent blocks</div>
        <div className="rs-explorer-list">
          {blocks.length === 0 ? (
            <p className="rs-muted rs-explorer-empty">
              No persisted blocks yet. When command capture lands, recent shell blocks appear here for quick recall.
            </p>
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
