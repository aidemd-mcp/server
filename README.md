[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://github.com/aidemd-mcp/server)
[![CI](https://github.com/aidemd-mcp/server/actions/workflows/ci.yml/badge.svg)](https://github.com/aidemd-mcp/server/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@aidemd-mcp/server.svg)](https://www.npmjs.com/package/@aidemd-mcp/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![server MCP server](https://glama.ai/mcp/servers/aidemd-mcp/server/badges/score.svg)](https://glama.ai/mcp/servers/aidemd-mcp/server)
[![npm downloads](https://img.shields.io/npm/dm/@aidemd-mcp/server.svg)](https://www.npmjs.com/package/@aidemd-mcp/server)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Discord](https://img.shields.io/discord/1496212051377262692?label=Discord&logo=discord)](https://discord.gg/N4NqMXuvTR)

# @aidemd-mcp/server

MCP server that brings intent-driven development to any AI-powered IDE.
Manage `.aide` spec files that live next to your code — the domain context
that architects plan from, implementors build from, and QA validates against.

Learn more at [aidemd.dev](https://aidemd.dev).

## Features

- **Project-wide spec discovery** with a progressive disclosure tree that surfaces intent, research, and QA specs at every level of your codebase
- **One-command project bootstrap** via `aide_init` — wires methodology docs, pipeline commands, and this MCP server into your project in a single guided flow
- **Automatic naming convention enforcement** — `aide_scaffold` handles the `.aide` / `intent.aide` rename rules so you never create conflicting specs
- **Guarded pipeline cleanup** via `aide_cleanup` — removes a closed module's plan, todo and brief only when every checkbox is checked, and refuses with the exact open items otherwise
- **Health-check validation** via `aide_validate` — detects orphaned specs, missing descriptions, broken links, and naming conflicts before they cause drift
- **Code introspection** via `aide_inspect` — returns JSDoc, signatures, and kind for named symbols without opening files, giving agents Tier 2 progressive disclosure for code
- **Upgrade drift detection** via `aide_upgrade` — compares your project's AIDE methodology artifacts against canonical versions and writes updates per-category
- **Runtime brain entry-point** via `aide_brain` — on-demand tool that returns ready-to-execute prose telling the agent which MCP tools to call and how to reach whatever brain backend is wired, without the agent knowing which backend it is

## Installation

### Quick Start (Claude Code)

Pick a launch mode — init asks, recommends global, and never switches an existing entry.

**Global** — pick it on a personal machine: reliable startup, stays on the installed version.

```bash
npm i -g @aidemd-mcp/server
aidemd-mcp init
```

**Local** — pick it for shared repos and cloud/CI: pinned to one exact version that `/aide:upgrade` moves forward.

```bash
npx -y @aidemd-mcp/server@0.10.2 init
```

`--mode global|local` skips the question (non-interactive runs default to local).

This command:

- Merges the AIDE MCP server entry into `.mcp.json`
- Writes the bundled brain config template to `.aide/config/brain.aide` (the brain location stays unset until `/aide:brain config` fills it and writes the brain MCP entry)
- Writes every pipeline slash command to `.claude/commands/aide/`
- Installs 10 canonical pipeline agents to `.claude/agents/aide/` and the `kanban-maintainer` board agent to `.claude/agents/kanban/`
- Installs skills (`study-playbook`, `brain`, `aide`, `aide-handoff`, `kanban`) to `.claude/skills/`
- Installs the methodology docs hub to `.aide/docs/`
- Writes the `aide-tree` launcher to `.aide/bin/aide-tree.mjs`
- Adds an AIDE badge to `README.md` (appends if not present)

All operations are additive — files that already exist are never overwritten. Safe to re-run at any time.

`init` asks for no brain location, path or token, and rejects backend flags such as `--vault-path`. `--brain <integration>` picks the bundled template (today only `obsidian`, the default).

After running, open Claude Code and run `/aide`. On the first run it routes to `/aide:brain config`, which fills the brain location in `.aide/config/brain.aide`, writes the brain MCP entry through sync, and seeds the brain. Anything else `init` could not finish is named in its closing follow-up list.

### Syncing brain.aide to .mcp.json

Run this after editing `.aide/config/brain.aide` — for example, when you update the brain path argument in `mcpServerConfig.args` or rename the brain in the `name` field:

Global:

```bash
aidemd-mcp sync
```

Local (use the version your `aide` entry pins):

```bash
npx -y @aidemd-mcp/server@0.10.2 sync
```

`sync` reads `.aide/config/brain.aide`, copies `mcpServerConfig` verbatim into `.mcp.json` under the fixed `brain` key, and writes the `name` field as the server label. Every other key in `mcpServers` (including your `aide` entry and any personal MCP integrations) is left byte-identical. If a legacy `obsidian` key is present it is removed in the same write. The command is idempotent — running it twice produces the same `.mcp.json` bytes, and the second invocation prints `already in sync` without touching the file. Exit code is `0` on success (including the no-change case), `1` on a missing or malformed `brain.aide` or invalid `.mcp.json`, and `2` on `--help`.

Example output after updating the brain path in `mcpServerConfig.args`:

```
Read .aide/config/brain.aide
Wrote brain MCP entry into .mcp.json
  command: mcpvault
  args: [D:/notes/new-brain]
Done.
```

### Manual Configuration

If you use a client other than Claude Code, or prefer to configure manually, add the server entry to your client's MCP config file.

#### Claude Code

**Global** — recommended on your own machine. Install once, then register:

```bash
npm i -g @aidemd-mcp/server
claude mcp add aide -- aidemd-mcp
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

**Local, pinned** — for shared repos and cloud/CI:

```bash
claude mcp add aide -- npx -y @aidemd-mcp/server@0.10.2
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@0.10.2"]
    }
  }
}
```

> [!NOTE]
> The Quick Start command above handles this automatically for Claude Code users.

#### Claude Desktop

Config file locations:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Global** — recommended on your own machine (after `npm i -g @aidemd-mcp/server`):

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

**Local, pinned** — for shared repos and cloud/CI:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@0.10.2"]
    }
  }
}
```

> [!NOTE]
> Claude Desktop does not inherit the terminal PATH. If you use nvm or Homebrew to manage Node, `npx` may not be found. Run `which npx` in your terminal to get the absolute path and replace `"npx"` with it in the config above.

Claude Desktop requires a full quit-and-reopen after any config change.

#### Cursor

Add to `~/.cursor/mcp.json`:

**Global** — recommended on your own machine (after `npm i -g @aidemd-mcp/server`):

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

**Local, pinned** — for shared repos and cloud/CI:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@0.10.2"]
    }
  }
}
```

#### VS Code / Copilot

Add to `.vscode/mcp.json`:

**Global** — recommended on your own machine (after `npm i -g @aidemd-mcp/server`):

```json
{
  "servers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

**Local, pinned** — for shared repos and cloud/CI:

```json
{
  "servers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@0.10.2"]
    }
  }
}
```

> [!NOTE]
> VS Code / Copilot uses `"servers"` as the root key, not `"mcpServers"`. Using the wrong root key causes the server to silently fail to load.

#### Windsurf

Add to `~/.windsurf/mcp.json`:

**Global** — recommended on your own machine (after `npm i -g @aidemd-mcp/server`):

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

**Local, pinned** — for shared repos and cloud/CI:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@0.10.2"]
    }
  }
}
```

## Tools

### aide_discover

Scan the project for `.aide` spec files and return a progressive disclosure tree map showing each spec's type, location, and summary.

**Inputs:**

- `path` (string, optional): Subdirectory to drill into. When provided, the response opens with the ancestor chain — the cascading intent lineage from root to target, each ancestor showing its description and alignment status — followed by the detailed subtree with summaries and warnings. When omitted, returns a shallow project-wide map (locations and types only).

### aide_read

Read an `.aide` spec file with full context, returning the file content, its classified type (intent/research/plan/todo), related specs in the same directory, and links found in the content.

**Inputs:**

- `path` (string, required): Path to the `.aide` file to read.

### aide_scaffold

Create new `.aide` spec files with automatic naming convention enforcement. Handles the rename rules: intent specs are `.aide` by default but become `intent.aide` when `research.aide` exists in the same folder; creating a `research.aide` auto-renames any existing `.aide` to `intent.aide`.

**Inputs:**

- `directory` (string, required): Directory where the `.aide` file(s) will be created.
- `type` (string, required): Type of `.aide` file to create. One of: `intent`, `research`, `both`, `todo`, `plan`.

### aide_cleanup

Remove a closed module's pipeline ephemerals — `brief.aide`, `todo.aide` and `plan.aide` — and nothing else. The preconditions are enforced in code: the module must have a `plan.aide` with every checkbox checked, and a `todo.aide`, if present, must be fully checked. Otherwise the tool refuses, removes nothing, and names each unchecked item with its file and line. It never touches intent specs, code or `.aide/session.aide`, and it refuses paths outside the project. Cross-platform with no shell, so cleanup needs no `rm` permission — allow the tool by name.

**Inputs:**

- `path` (string, required): Module folder that holds the ephemerals, relative to the project root.
- `dryRun` (boolean, optional): Report what would be removed, or what blocks removal, without removing anything. For inspection only — the real call is already safe.
- `allowEmptyPlan` (boolean, optional): Let a `plan.aide` with no checkboxes pass. Overrides nothing else.

### aide_inspect

Return the JSDoc block, signature, and kind for a named function, method, class, interface, or type alias in the workspace — Tier 2 progressive disclosure for code. Agents can understand a symbol's contract without opening the file.

**Inputs:**

- `name` (string, required): Symbol name to look up.
- `file` (string, optional): Restrict search to a single file (relative to project root).

### aide_validate

Run a health check on `.aide` spec files in the project. Detects orphaned specs, missing specs, naming conflicts (`.aide` and `intent.aide` in the same folder), broken links, orphaned research files, and missing frontmatter descriptions.

**Inputs:**

- `path` (string, optional): Subdirectory to validate. Defaults to the entire project when omitted.

### aide_info

Boot-time precondition reporter. Returns two independent fields the orchestrator branches on separately: `outdated` (an array of stale AIDE artifact keys, comparing the project's `versions.json` against the shipped manifest), and `brain` (a `{ status, name?, hints }` object reporting whether the project's `brain.aide` config is wired into `.mcp.json`). `brain.status` is a closed five-status union: `ok | no-brain-aide | brain-aide-invalid | no-mcp-entry | mcp-drift`, derived by comparing `.aide/config/brain.aide` against `.mcp.json` — no disk path validation. `brain-aide-invalid` means the file is present but unusable and carries a `fault`: either `missing-sections` (naming the required sections that are absent) or `malformed` (with a reason, which also covers a file that cannot be read). `name` is the user-declared label from `brain.aide`; it is absent on `no-brain-aide` and `brain-aide-invalid`. `/aide:brain config` is the recovery for both `no-brain-aide` and `brain-aide-invalid`. `hints` is an array of candidate vault locations the orchestrator can surface during recovery.

**Inputs:**

(none)

### aide_brain

On-demand brain entry-point tool. Call this when you need to reach the brain mid-task — do NOT call it on every `/aide` boot. Boot-time brain precondition state is already reported by `aide_info.brain.status`; firing `aide_brain` at boot duplicates that work unnecessarily.

Returns `{ status, instructions }` — exactly two fields. No `backend`, no `connector`, no `name`. `status` mirrors `aide_info.brain.status` (`ok | no-brain-aide | brain-aide-invalid | no-mcp-entry | mcp-drift`). `instructions` is always non-empty: on `ok` it is the verbatim body of the selected section (`orientation` or `config`, per the optional `kind` input) from the user's `.aide/config/brain.aide` (no server substitution); on the failure states it carries remediation prose. `no-brain-aide` and `brain-aide-invalid` both route to `/aide:brain config`; `brain-aide-invalid` is composed from the detector's `fault` — either the missing required sections, named, or the malformed reason (including a file that is present but unreadable, which is never reported as absent). `no-mcp-entry` and `mcp-drift` tell the user to run sync with the launcher their `aide` entry uses (`aidemd-mcp sync` or `npx -y @aidemd-mcp/server@<version> sync`).

**Inputs:**

(none)

### aide_init

Bootstrap the AIDE development environment into a project using a guided one-at-a-time wizard. On the first call (no `category`), returns a summary of every step with status and detected framework. On subsequent calls (with `category`), writes all pending files for that category to disk and returns a manifest.

**Inputs:**

- `framework` (string, optional): Force a specific framework instead of auto-detecting. One of: `claude`, `cursor`, `windsurf`, `copilot`.
- `path` (string, optional): Custom project root path. Defaults to the server working directory.
- `category` (string, optional): Write all `would-create` files for this category and return a manifest. One of: `framework`, `methodology`, `commands`, `agents`, `skills`, `mcp`, `brain`, `ide`, `readme`. Omit on the first call to get a metadata-only summary.
- `aideMode` (string, optional): Launch mode for the aide MCP entry, `global` (recommended) or `local`. Pass with `category=mcp`.
- `brainMode` (string, optional): Launch mode for the brain template's launcher, `global` or `local`. Pass with `category=brain`.

### aide_upgrade

Compare the AIDE methodology artifacts in this project against canonical versions and return a structured diff grouped by category. On the first call (no `category`), returns a lightweight summary of every category with drift status. On subsequent calls (with `category`), writes all diffed or missing files for that category to disk and returns a manifest.

**Inputs:**

- `framework` (string, optional): Force a specific framework instead of auto-detecting. One of: `claude`, `cursor`, `windsurf`, `copilot`.
- `path` (string, optional): Custom project root path. Defaults to the server working directory.
- `category` (string, optional): Write all drifted or missing files for this category and return a manifest. One of: `pointer-stub`, `methodology-docs`, `version-metadata`, `commands`, `agents`, `skills`, `mcp`, `ide`, `readme`. Omit on the first call to get a metadata-only summary.

## Getting Started

After adding the server to your MCP client, ask your agent to run `aide_init` to bootstrap the AIDE methodology into your project. This installs the methodology docs, scaffolds pipeline commands, and wires everything up.

Then try: "Scaffold an intent spec for my authentication module" — the agent will use `aide_discover` to map your project and `aide_scaffold` to create the spec in the right place with the right naming conventions.

## Development

```bash
npm install
npm run build
npm test
```

## License

[MIT](https://github.com/aidemd-mcp/server/blob/main/LICENSE)
