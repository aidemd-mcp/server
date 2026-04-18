[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://github.com/aidemd-mcp/server)
[![npm version](https://img.shields.io/npm/v/@aidemd-mcp/server.svg)](https://www.npmjs.com/package/@aidemd-mcp/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# @aidemd-mcp/server

MCP server that brings intent-driven development to any AI-powered IDE.
Manage `.aide` spec files that live next to your code — the domain context
that architects plan from, implementors build from, and QA validates against.

## Features

- **Project-wide spec discovery** with a progressive disclosure tree that surfaces intent, research, and QA specs at every level of your codebase
- **One-command project bootstrap** via `aide_init` — wires methodology docs, pipeline commands, and this MCP server into your project in a single guided flow
- **Automatic naming convention enforcement** — `aide_scaffold` handles the `.aide` / `intent.aide` rename rules so you never create conflicting specs
- **Health-check validation** via `aide_validate` — detects orphaned specs, missing descriptions, broken links, and naming conflicts before they cause drift
- **Upgrade drift detection** via `aide_upgrade` — compares your project's AIDE methodology artifacts against canonical versions and writes updates per-category

## Installation

### Quick Start (Claude Code)

The fastest path is a single npx command that wires everything up automatically:

```bash
npx @aidemd-mcp/server@latest init
```

This command:
- Merges the AIDE MCP server entry into `.mcp.json` (creates the file or skips the entry if already present)
- Writes the `/aide:init` slash command to `.claude/commands/aide/init.md` (skips if exists)
- Writes the `aide-tree` launcher to `.aide/bin/aide-tree.mjs` (skips if exists)

All operations are idempotent — safe to re-run at any time.

After running, open Claude Code and run `/aide:init` to complete setup.

### Manual Configuration

If you use a client other than Claude Code, or prefer to configure manually, add the server entry to your client's MCP config file.

#### Claude Code

```bash
claude mcp add aide npx -- -y @aidemd-mcp/server@latest
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@latest"]
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

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@latest"]
    }
  }
}
```

> [!NOTE]
> Claude Desktop does not inherit the terminal PATH. If you use nvm or Homebrew to manage Node, `npx` may not be found. Run `which npx` in your terminal to get the absolute path and replace `"npx"` with it in the config above.

Claude Desktop requires a full quit-and-reopen after any config change.

#### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@latest"]
    }
  }
}
```

#### VS Code / Copilot

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@latest"]
    }
  }
}
```

> [!NOTE]
> VS Code / Copilot uses `"servers"` as the root key, not `"mcpServers"`. Using the wrong root key causes the server to silently fail to load.

#### Windsurf

Add to `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["-y", "@aidemd-mcp/server@latest"]
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

### aide_validate

Run a health check on `.aide` spec files in the project. Detects orphaned specs, missing specs, naming conflicts (`.aide` and `intent.aide` in the same folder), broken links, orphaned research files, and missing frontmatter descriptions.

**Inputs:**
- `path` (string, optional): Subdirectory to validate. Defaults to the entire project when omitted.

### aide_init

Bootstrap the AIDE development environment into a project using a guided one-at-a-time wizard. On the first call (no `category`), returns a summary of every step with status and detected framework. On subsequent calls (with `category`), writes all pending files for that category to disk and returns a manifest.

**Inputs:**
- `framework` (string, optional): Force a specific framework instead of auto-detecting. One of: `claude`, `cursor`, `windsurf`, `copilot`.
- `path` (string, optional): Custom project root path. Defaults to the server working directory.
- `category` (string, optional): Write all `would-create` files for this category and return a manifest. One of: `framework`, `methodology`, `commands`, `agents`, `skills`, `mcp`, `brain`, `ide`. Omit on the first call to get a metadata-only summary.
- `brainPath` (string, optional): Resolved brain vault path. Required when `category=brain`.

### aide_upgrade

Compare the AIDE methodology artifacts in this project against canonical versions and return a structured diff grouped by category. On the first call (no `category`), returns a lightweight summary of every category with drift status. On subsequent calls (with `category`), writes all diffed or missing files for that category to disk and returns a manifest.

**Inputs:**
- `framework` (string, optional): Force a specific framework instead of auto-detecting. One of: `claude`, `cursor`, `windsurf`, `copilot`.
- `path` (string, optional): Custom project root path. Defaults to the server working directory.
- `category` (string, optional): Write all drifted or missing files for this category and return a manifest. One of: `pointer-stub`, `methodology-docs`, `version-metadata`, `commands`, `agents`, `skills`, `mcp`, `ide`. Omit on the first call to get a metadata-only summary.

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
