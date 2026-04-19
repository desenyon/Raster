# Raster

## Builder protocol (read every session)

This file is the **product north star** and default context for building Raster. Engineering discipline is defined in [`CURSOR.md`](./CURSOR.md). Treat both as living documents: **update them when decisions change**, so future sessions inherit the truth.

### Mandatory order of operations

1. **Read [`CURSOR.md`](./CURSOR.md) before writing code** — assumptions explicit, simplicity first, surgical diffs, verifiable goals.
2. **Re-open the relevant section of this file** — pick a single pillar or v1 checklist item; do not drift into unprompted scope.
3. **Define success in one screen** — what the user can do, what you will run to prove it (tests, scripts, manual steps), and what must not regress.
4. **Ship the smallest vertical slice** — user-visible or trust-critical behavior beats internal refactors unless the refactor unblocks the slice.
5. **Verify, then narrate gaps** — pass checks; log known limitations and the next slice to pick.

### Iterative loop (continuous improvement)

Raster beats Warp by **compounding** correct increments: native performance, local trust, structured blocks, and transparent agents. Each iteration should complete this loop:

```
Assumption check → smallest plan → implement → verify → note follow-ups
```

For multi-step work, write a brief numbered plan where **each step has a verification** (matches the pattern in `CURSOR.md`). Prefer loops you can run without asking the user for clarification.

### Competitive bar vs Warp

Warp is the benchmark, not the ceiling. Match its best interaction patterns, **exceed** on dimensions Raster owns:

| Dimension | Meet (parity) | Beat (Raster) |
| --- | --- | --- |
| Terminal UX | Fast PTY, splits/tabs, palette, blocks | Lower latency, calmer native UI, clearer hierarchy |
| Blocks | Command/output grouping, rerun, copy | Timeline scrubber, provenance, resource hints, richer export |
| AI / agents | Helpful command assistance | **Local-first**, inspectable context, approvals, audit trail, Ollama-native |
| Trust | Visible commands | Execution recorder, task graph, policy classes, no hidden cloud path |
| Knowledge | Notebooks / workflows | Local workbooks + TOML workflows, composition, dry-run |
| Editor / review | Inline edits, diffs | Review queue, risk labels, hunk comments, link diffs to commands |

If a change does not move a row forward, reconsider scope.

### When instructions conflict

Prefer **user safety and local-first guarantees** over speed. Prefer **`CURSOR.md` minimalism** over feature sprawl. If product spec and engineering discipline disagree, **narrow the feature** until they align.

---

## What this is

Raster is a macOS native agentic terminal and coding environment written in Rust.

It should feel like a better, more opinionated, more local first version of Warp.

Raster is not a cloud product.
Raster does not depend on a remote orchestration layer.
Raster does not route prompts, code, terminal output, indexing artifacts, or agent state through vendor servers.
Raster runs locally on the user’s Mac.
Raster supports external APIs only when the user explicitly configures them.
Raster has first class built in support for fully local models through Ollama.

The product goal is simple:
Build the best terminal workbench for real engineering work on macOS, with native performance, strict local control, best in class UX, and powerful multi agent workflows.

---

# Core product thesis

Existing agent terminals are split between two bad extremes:

1. Traditional terminals are fast but primitive.
2. Cloud agent platforms are powerful but leak control, add latency, obscure execution, and create trust issues.

Raster should win by combining:

* native terminal speed
* transparent local execution
* structured command and output navigation
* real code editing and diff review
* multi agent workflows
* local model support through Ollama
* beautiful macOS quality UI
* deterministic, auditable behavior

Raster should feel like:

* Terminal.app if it were rebuilt for serious modern engineering
* a lightweight IDE when needed
* a local agent runtime when asked
* a debugging cockpit for humans supervising machines

---

# Non negotiable principles

## Local first

* All agent state is stored locally by default.
* All conversations are local by default.
* All command history is local.
* All indexing is local.
* All embeddings are local.
* All workflow definitions are local files.
* No analytics by default.
* No cloud dependency for core functionality.

## Human control

* Agents never become invisible.
* Every file edit is reviewable.
* Every shell command is inspectable.
* Risky commands require explicit approval unless the user changes policy.
* The app always shows what an agent is doing, why, and what changed.

## Native quality

* macOS first.
* Keyboard first.
* Fast startup.
* Smooth scrolling.
* Excellent text rendering.
* High frame rate pane resizing.
* Zero web app feel.

## Deterministic architecture

* Each major subsystem is isolated.
* Clear process boundaries.
* Logs for everything important.
* Recoverable state after crash.

## Beautiful restraint

* No clutter.
* No gimmicks.
* Strong information hierarchy.
* High density without feeling cramped.

---

# Target user

Primary user:
A serious developer on macOS who lives in the terminal, works across multiple repos, wants agent assistance, wants local model support, and does not want cloud orchestration or vague AI behavior.

Secondary users:

* security conscious engineers
* founders building locally
* ML and infra engineers
* traders and quants who want local tools
* Rust, Python, TypeScript, and systems developers

---

# Product pillars

## 1. Native terminal foundation

Raster is first a world class terminal.

### Requirements

* PTY based terminal emulator
* high performance rendering
* Unicode and emoji width correctness
* ligatures optional
* shell support for zsh, bash, fish
* proper TERM handling
* configurable scrollback limits with smart persistence
* tmux compatibility
* SSH support
* split panes
* tabs
* vertical tab rail
* session restore
* launch profiles
* command palette
* keyboard remapping
* Vim style input mode optional

### Terminal UX

* IDE like input editor inside terminal prompt area
* multi line editing
* syntax aware shell editing where possible
* smart completions
* command history search
* block based output navigation
* copy command only, output only, or both
* replay command into input
* bookmark blocks
* search within a block and across blocks

---

## 2. Structured blocks as a first class primitive

Raster should keep Warp’s strongest interaction model and improve it.

### Block model

A block is an atomic unit consisting of:

* command metadata
* raw command text
* rendered command text
* stdout stream
* stderr stream
* exit status
* timing data
* working directory
* git context
* environment snapshot metadata
* agent annotations if present

### Block actions

* copy command
* copy output
* copy both with formatting
* rerun
* rerun in new pane
* save as workflow
* attach to agent as context
* pin
* collapse
* bookmark
* export to markdown
* export to plain text

### Better than Warp

Add:

* block timeline scrubber for very long commands
* per block resource metrics if available, including duration and optional CPU and memory sample summary
* inline diff attachment for blocks that changed files
* provenance panel showing which agent or user action led to this block

---

## 3. Agent system that is local by default

Raster includes agents, but they are not cloud agents.

### Agent modes

#### Interactive local agents

* live inside a dedicated side panel or full conversation pane
* can inspect terminal blocks, files, diffs, search results, and repo index
* can suggest commands before running them
* can run commands with approval policy
* can edit files through the edit engine
* can plan multi step tasks
* can be interrupted at any time

#### Background local agents

* run as supervised local jobs on the Mac
* used for indexing, refactoring passes, repo summaries, test triage, documentation generation, code review suggestions, and watch tasks
* never require remote infrastructure
* can be paused, resumed, killed, and replayed

#### External agent compatibility

Raster should also be the best shell for running agent CLIs, including Claude Code, Codex CLI, Gemini CLI, OpenCode, and custom tools.

Support:

* notifications for agent output
* tab metadata
* run grouping
* command provenance
* branch and worktree awareness
* agent specific status chips

### Agent control model

Every agent run has:

* status
* active objective
* current step
* accessed files
* executed commands
* pending approvals
* generated diffs
* token and latency metrics if model exposes them
* model used
* context sources used

### Agent permissions

Per project policy:

* read only
* can run safe commands
* can edit files but not execute
* can execute but require approval for write operations
* full access with denylist

### Approval classes

* harmless read only commands can auto run
* file writes require review or policy allowance
* destructive shell commands always require confirmation
* network operations require explicit permission toggle
* git push requires explicit confirmation

---

## 4. Local models through Ollama

This is a core feature, not a side integration.

### Built in Ollama support

Raster should detect a local Ollama daemon automatically and expose:

* model picker
* health status
* pull model flow
* model memory requirements
* model context length
* latency estimates from prior runs
* quick switch per tab or per agent

### Supported model flows

* chat completion through Ollama
* code editing tasks
* summarization
* local embeddings generation
* repo indexing and semantic search
* title generation for tabs and sessions
* commit message generation

### Model routing

Users can choose:

* strict local only mode
* prefer local then fallback to user configured API provider
* per task model routing

Default must be strict local only.

### Suggested default local model tiers

* lightweight fast assistant for terminal help
* medium coding model for refactors and code review
* larger reasoning model for planning and architecture
* embedding model for semantic retrieval

Raster should not hardcode model names in the product spec, but the architecture must allow model profiles.

---

## 5. Code editing and diff review

Raster must include a real editor and not feel trapped inside a terminal.

### Editor requirements

* open files from terminal output, search, tree, and agent results
* tabs for editor buffers
* syntax highlighting
* minimap optional
* find and replace
* multi cursor if feasible
* format on save optional
* LSP integration architecture
* inline diagnostics
* diff view
* compare against working tree, HEAD, main, arbitrary branch

### Review flow

* agent edits create tracked change sets
* user can inspect hunks
* accept hunk
* reject hunk
* comment on hunk
* send all comments back to the agent in one pass
* reopen full file editor from diff panel

### Better than Warp

Add:

* review queue grouped by task
* semantic diff summaries above hunks
* risk labels such as tests changed, migrations changed, config changed, dependency changed
* inline command replay linking a diff to the command or tool call that produced it

---

## 6. File tree and project explorer

The left rail should include a native project explorer.

### Capabilities

* file tree
* create file and folder
* rename
* move
* duplicate
* reveal in Finder
* open in external editor
* copy relative path
* copy absolute path
* attach file to agent context
* attach directory to agent context
* show git status badges
* filter ignored files

### Better than Warp

Add:

* quick attach of selected tree subtree as scoped context for agent
* token or size estimate before attaching context
* one click build a task from selected files

---

## 7. Knowledge and workflows without cloud sync

Warp has notebooks and workflows. Raster should do this better locally.

### Raster Workbooks

A workbook is a local markdown plus runnable snippets document.

Capabilities:

* markdown sections
* shell snippets
* code snippets
* variables
* attachments to blocks and files
* local search
* export as md
* run snippet in current pane or new pane
* pin workbook to project

Storage:

* plain markdown plus frontmatter in a local project directory
* optionally tracked in git

### Raster Workflows

A workflow is a parameterized local command or multi step task definition.

Capabilities:

* name
* description
* arguments
* enum arguments
* default values
* dynamic values sourced from shell commands
* run in current pane or detached job
* reference environment profiles
* save from block or manually author

Storage format:

* TOML files under a user visible workflows directory

### Better than Warp

Add:

* workflow composition where one workflow can call another
* workflow dry run preview
* workflow test mode
* signed workflow bundles for teams that share via git instead of cloud

---

## 8. Project memory that stays on device

Raster needs a local knowledge store.

### Stored locally

* session history
* bookmarks
* pinned blocks
* workbook metadata
* workflow index
* repo summaries
* agent memory per project
* user rules and preferences
* semantic index for code and notes

### Storage requirements

* SQLite for metadata and structured state
* local vector index for embeddings
* content addressable blob store for larger artifacts if needed
* no remote sync unless user explicitly sets it up later as a file based sync option

### Agent memory model

Per project:

* coding conventions
* important commands
* architecture notes
* recent decisions
* preferred test commands
* approval preferences

Memory must be inspectable and deletable.

---

## 9. Notifications and attention management

Raster should be excellent for multi thread development.

### Notification system

* in app notification center
* macOS native notifications
* per tab attention badges
* per agent run status
* completion, error, approval needed, test failure, merge conflict, long run finished

### Better than Warp

Add:

* smart attention ranking
* quiet hours
* notification bundling by task
* focus mode that suppresses low priority agent chatter

---

## 10. Git and worktree intelligence

Git should be a top tier feature.

### Git features

* current branch in tab metadata
* worktree detection
* branch compare
* staged and unstaged diff views
* commit authoring assistant
* commit template support
* stash visualization
* cherry pick helper
* rebase support indicators
* merge conflict browser

### Better than Warp

Add:

* worktree dashboard
* one click create task specific worktree
* agent per worktree
* task to PR mapping panel

---

# Additional built in features that should exceed Warp

## 1. Task graph

A visual local graph of:

* goals
* runs
* commands
* diffs
* files touched
* tests executed
* commits created

This becomes the audit trail for agent work.

## 2. Execution recorder

For each agent task, store:

* initial prompt
* context sources
* commands run
* output summaries
* files changed
* review actions
* final result

Replayable locally.

## 3. Safety sandbox profiles

Optional profiles for:

* unrestricted local
* write limited
* network disabled
* repo scoped
* temp workspace only

## 4. Structured runbooks

Turn successful agent sessions into reusable runbooks automatically.

## 5. Semantic command search

Search not only exact command history, but intent.
Examples:

* find the command I used to rebuild uv lockfiles
* show the test command used for auth failures last week

## 6. Failure analyzer

When commands fail, Raster can automatically:

* summarize failure
* surface likely cause
* show nearby related successful runs
* suggest a recovery workflow

## 7. Snapshot and rollback

Create local task snapshots of:

* branch
* modified files
* active tabs
* notebook state
* workflow context

## 8. Model evaluation panel

Show how local models perform for specific tasks on the user’s machine.
Track:

* latency
* tokens per second if available
* success rate by task category
* user acceptance rate

## 9. Context budget inspector

Before sending context to a model, show:

* which files and blocks are included
* approximate token usage
* why each item is included
* what can be dropped

## 10. Local MCP style tool integration

Support a standardized local tool server interface.
Users can wire in:

* GitHub
* Linear
* Sentry
* Postgres
* custom scripts
* internal developer tools

This should run locally and be configured through local files.

---

# Exact technical architecture

## Primary stack

* Language: Rust
* macOS app shell: Tauri v2 or a pure native Rust plus Swift bridge approach
* Recommended direction: Rust core with small SwiftUI or AppKit shell only where truly necessary for best macOS integration
* Terminal emulation: a Rust terminal engine, preferably based on a proven terminal parser and renderer stack
* PTY management: Rust PTY crate or custom abstraction for macOS PTY handling
* UI rendering: GPU accelerated rendering through native windowing and performant text rendering
* Data store: SQLite
* Search index: Tantivy or equivalent local full text engine
* Vector index: use a local vector store library or custom HNSW backed by disk persisted embeddings
* Embeddings: local embedding model through Ollama or a bundled local runtime option
* Diff engine: tree sitter aware diff summary plus standard textual diff backend
* Syntax parsing: Tree sitter
* LSP support: rust-analyzer style integration architecture via language server protocol client layer
* Job system: Tokio based async orchestration with structured task supervisors
* State sync between subsystems: event bus with typed events

## Process model

Use a multi process design.

### Process 1: App shell

Responsible for:

* windows
* tabs
* panes
* UI state
* command palette
* notifications
* editor views

### Process 2: Terminal engine

Responsible for:

* PTY sessions
* shell IO
* block segmentation
* command metadata
* scrollback persistence

### Process 3: Agent runtime

Responsible for:

* model invocation
* planning
* command proposals
* tool execution
* memory retrieval
* approval queue
* task supervision

### Process 4: Indexer

Responsible for:

* codebase scanning
* chunking
* embeddings
* semantic search
* file and symbol metadata

### Process 5: Git service

Responsible for:

* repo status
* worktree detection
* diffs
* branch comparisons
* conflict inspection

This separation improves crash isolation and trust.

## Internal IPC

* typed message schema
* request response plus event subscription
* durable local logs
* structured JSON logs for debugging

## Local storage layout

```text
~/Library/Application Support/Raster/
  state.db
  logs/
  sessions/
  indexes/
  embeddings/
  projects/
  workflows/
  workbooks/
  settings/
  cache/
```

---

# Agent runtime design

## Core components

* planner
* context retriever
* tool executor
* approval engine
* edit engine
* reflection engine
* summarizer

## Agent loop

1. Parse user goal.
2. Retrieve relevant context from blocks, files, repo index, memory, and user rules.
3. Produce a visible plan.
4. Ask for approval if needed for risky actions.
5. Execute step.
6. Stream reasoning summary, not hidden chain of thought.
7. Capture outputs as blocks, diffs, and task events.
8. Replan if command results change assumptions.
9. Present final result with review artifacts.

## Tooling available to agent

* shell command tool
* file read tool
* file edit tool
* search tool
* git tool
* diff review tool
* workflow runner
* workbook retrieval
* local MCP tool bridge

## File editing strategy

Use safe atomic writes.

* write to temp
* validate when possible
* create diff
* swap into place
* update editor and review panel

## Approval engine

Risk categories:

* read only
* local write
* destructive write
* network access
* credential access
* long running background task

Every approval request should show:

* exact action
* why it is needed
* affected scope
* safer alternative if one exists

---

# Indexing and retrieval design

## Code indexing

* only index git tracked files by default
* allow explicit opt in for untracked files
* incremental indexing on save
* branch aware and worktree aware
* per project exclusion rules

## Retrieval sources

* current file
* selected files
* open editor tabs
* recent terminal blocks
* pinned blocks
* workbooks
* workflows
* project memory
* semantic code index

## Ranking strategy

Blend:

* lexical match
* semantic match
* recency
* active tab proximity
* git branch proximity
* user pinned importance

## Transparency

Before agent execution, the user can open a context inspector showing exactly what was selected.

---

# UI and interaction design

## Overall style

Raster should look premium, dark, calm, sharp, and dense.
It should feel closer to a native macOS pro app than a browser styled dashboard.

Tone:

* serious
* technical
* elegant
* minimal
* high trust

Avoid:

* purple gradients
* playful SaaS visuals
* oversized rounded toy controls
* noisy borders
* excessive shadows
* anything that feels webby

## Color system

Dark mode only for v1.

### Base colors

* App background: #09090B
* Surface 1: #111113
* Surface 2: #15171A
* Surface 3: #1B1E23
* Surface 4: #232730

### Text

* Primary text: #F5F7FA
* Secondary text: #B6BDC8
* Tertiary text: #7C8696
* Disabled text: #5B6370

### Accents

Primary accent should be cool electric blue.

* Accent primary: #4DA3FF
* Accent primary hover: #78B8FF
* Accent primary muted: rgba(77,163,255,0.18)

Success:

* #34C759

Warning:

* #FF9F0A

Error:

* #FF5F57

Info:

* #64D2FF

Git colors:

* Added: #2FBF71
* Modified: #F5C451
* Deleted: #FF6B6B

### Selection and focus

* Focus ring: rgba(77,163,255,0.55)
* Selection bg: rgba(77,163,255,0.22)
* Active panel edge: rgba(77,163,255,0.35)

## Typography

* Primary UI font: SF Pro Text and SF Pro Display on macOS
* Monospace: JetBrains Mono or Berkeley Mono if available, else SF Mono
* Tight but readable spacing
* Small caps or uppercase only for subtle metadata labels

## Window layout

### Primary shell

Top bar:

* traffic lights on macOS
* workspace selector
* global command palette trigger
* model indicator
* active repo and branch summary
* notifications bell
* settings

Left rail:

* project explorer
* search
* workflows
* workbooks
* task graph
* history

Center:

* tabs and panes
* terminal or editor content

Right rail optional:

* agent conversation
* code review
* context inspector
* task details

Bottom utility strip optional:

* approval queue
* background tasks
* model status
* indexing status

## Tabs

Use vertical tabs by default.
Each tab shows:

* title
* shell or task icon
* git branch
* worktree indicator
* agent status if attached
* dirty state
* color stripe only when useful, not decorative

## Pane system

* split any tab horizontally or vertically
* drag to rearrange
* move pane to tab
* zoom pane
* focus follows keyboard

## Agent panel design

The agent panel should not feel like a chatbot.
It should feel like a mission control view.

Each response block shows:

* concise step summary
* actions taken
* outputs or files produced
* approvals requested
* follow up options

Do not show hidden reasoning.
Show decision summaries and operational transparency.

## Code review panel

* diff first layout
* file list on left
* hunk comments inline
* accept and reject controls
* summary chip row at top
* task association at top right

## Command palette

Fast global palette with categories:

* open file
* run workflow
* jump to tab
* search history
* open workbook
* switch model
* open task
* toggle UI features

---

# UX details that matter

## Performance targets

* cold launch under 1.5 seconds on modern Apple Silicon when possible
* terminal input latency should feel immediate
* pane split and resize should hold smooth frame pacing
* search results should appear progressively
* agent context retrieval should feel fast and explain progress

## Empty states

Never use generic marketing copy.
Use operationally useful empty states.
Example:
“No workflows yet. Save a command block as a workflow or create one manually.”

## Error states

Errors must be technical and actionable.
Show:

* what failed
* where it failed
* logs if relevant
* retry option
* fallback path

## Accessibility

* full keyboard navigation
* screen reader labels where feasible
* adjustable font size
* contrast safe defaults

---

# Settings design

## Top level settings

* General
* Appearance
* Terminal
* Editor
* Agents
* Models
* Ollama
* Indexing
* Workflows
* Notifications
* Privacy
* Keybindings
* Advanced

## Important settings

### Privacy

* telemetry off by default
* crash reports ask first
* network disabled mode
* redact secrets in blocks

### Models

* default model per task type
* context limits
* fallback behavior
* local only hard lock

### Agents

* approval policies
* allowed directories
* command denylist
* command allowlist
* max runtime
* auto summarize on completion

---

# Local file formats

## Workflow file example

```toml
name = "Run tests"
description = "Run the backend test suite with optional pattern"
command = "cargo test {{pattern}}"

[[args]]
name = "pattern"
type = "text"
default = ""
```

## Workbook frontmatter example

```yaml
title: Local debugging checklist
project: raster
labels:
  - debugging
  - onboarding
```

---

# Example flagship workflows

## 1. Fix failing tests

* inspect recent failing block
* attach changed files
* run agent with local coding model
* generate patch
* review diffs
* rerun targeted tests

## 2. Create task worktree

* branch from current base
* create worktree
* open new tab with preset pane layout
* attach agent to that worktree
* restore relevant workbook and workflow set

## 3. Explain repository area

* select directory in tree
* retrieve semantic summary
* show important files
* suggest workflows and recent related tasks

## 4. Turn session into runbook

* summarize successful session
* extract commands
* extract pitfalls
* save as workbook plus workflow bundle

---

# v1 feature checklist

## Must have

* native terminal
* tabs and panes
* block model
* command palette
* project explorer
* editor
* diff review
* local agents
* Ollama integration
* workflow system
* workbook system
* SQLite state
* local indexing
* notification center
* git branch metadata
* approval engine

## Should have

* worktree dashboard
* task graph
* semantic command search
* local MCP tool bridge
* context budget inspector
* model evaluation panel

## Later

* optional file based sync through user owned storage
* collaborative bundles through git
* remote SSH sidecar indexing
* plugin SDK

---

# Explicit anti goals

Do not build:

* a browser app wrapped as desktop software
* cloud first orchestration
* mandatory accounts for local use
* hidden remote tracing
* vague black box agent autonomy
* bloated IDE replacement trying to do everything
* toy visuals or flashy gradients

---

# Final prompt to the builder

Build Raster as a premium macOS native Rust application that rethinks the terminal around local first agents, structured command blocks, code review, workflows, and project memory.

It must outperform Warp in trust, local control, UI quality, and transparency.

Keep the strongest ideas:

* block based terminal navigation
* command palette
* file tree
* code review
* vertical tabs
* workflows and runnable documentation
* agent assisted development

Then improve them with:

* zero cloud dependency for core product behavior
* first class Ollama support
* better local model routing
* stronger approval and audit systems
* richer diff review
* task graph and execution replay
* smarter notifications
* a more serious macOS native interface

The end result should feel fast, precise, calm, technical, beautiful, and fully under the user’s control.

**Operational reminder:** execute in small verified slices using the **Builder protocol** at the top of this file and the rules in [`CURSOR.md`](./CURSOR.md); extend Raster toward the v1 checklist one provable increment at a time.
