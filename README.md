# Raster

Local-first workbench: terminal sessions, workspace explorer, git status, and an Ollama-backed agent panel. Built with **Tauri 2**, **React 19**, **Vite**, and **Rust**; block history lives in SQLite via `raster-core`.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/) stable
- **Ollama** (optional, for the agent): [ollama.com](https://ollama.com/) — default URL `http://127.0.0.1:11434`

## Development

```bash
npm install
npm run tauri dev
```

Production web build (no desktop shell):

```bash
npm run build
```

Rust only:

```bash
cargo build -p app
```

## Features (current)

| Area | Notes |
| --- | --- |
| Terminal | PTY tabs, xterm, block logging on Enter |
| Explorer | Navigable workspace tree (`list_dir` with `relPath` / `parent`) |
| Search | Indexer status placeholder until Tantivy lands |
| Git | Branch and porcelain status |
| Agent | Non-streaming Ollama chat (`/api/tags`, `/api/generate`) |
| Settings | Ollama base URL and default model (persisted under app data) |
| Workflows | `.toml` files in app data `workflows/` — `name`, `description`, `command` with `{{arg}}` placeholders |
| Workbooks | `.md` files in app data `workbooks/` — read-only viewer |

On macOS, Raster app data is under `~/Library/Application Support/Raster/` (workflows, workbooks, logs, indexes, `settings.json`, SQLite `state.db` path via `dirs`).

## License

See the repository license file if present.
