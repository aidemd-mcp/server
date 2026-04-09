# aidemd-mcp

MCP server that teaches any agent the AIDE (Autonomous Intel-Driven Engineering) methodology. When an agent connects, the tool descriptions themselves teach the convention — no config or documentation injection needed.

## What is AIDE?

AIDE specs are `.aide` files that live next to orchestrator code as progressive disclosure specs. They capture the domain context that code alone doesn't — strategy, research, implementation contracts, and anti-patterns.

| File | Purpose |
|------|---------|
| `.aide` | Intent spec (default). Strategy, contracts, anti-patterns. |
| `intent.aide` | Same as `.aide` — used only when `research.aide` exists in the same folder. |
| `research.aide` | Raw research. Sources, data points, pattern synthesis. |
| `todo.aide` | QA checklist. Issues found by audit agents. |

## Installation

Add to your MCP client config:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["aidemd-mcp"]
    }
  }
}
```

Or with a custom project root:

```json
{
  "mcpServers": {
    "aide": {
      "command": "npx",
      "args": ["aidemd-mcp", "--root", "/path/to/project"]
    }
  }
}
```

## Tools

### `aide_discover`

Scans the project for all `.aide` files and returns a progressive disclosure tree map. This is the flagship tool — it teaches the agent the entire module architecture at a glance.

**Input:** optional `path` (subdirectory to scan)

**Output:** Tree showing each spec's type, location, and summary.

### `aide_read`

Reads an `.aide` file with context awareness. Returns the file content, classified type, sibling specs in the same directory, and links found in the content (wikilinks, relative paths, URLs).

**Input:** `path` (required)

### `aide_scaffold`

Creates new `.aide` files with automatic naming convention enforcement. Handles auto-rename logic — creating a `research.aide` will rename an existing `.aide` to `intent.aide`.

**Input:** `directory` (required), `type` (required: `intent` | `research` | `both` | `todo`)

### `aide_validate`

Health check for `.aide` spec files. Detects orphaned specs, missing specs, naming conflicts, broken links, and orphaned research files.

**Input:** optional `path` (subdirectory to validate)

### `aide_init`

Bootstrap the AIDE development environment into a project with one command. Detects the agent framework, writes the AIDE methodology into the agent's config file, scaffolds slash commands for every pipeline phase (`/aide-research`, `/aide-spec`, `/aide-build`, `/aide-qa`, `/aide-fix`), and wires this MCP server into the project's MCP config.

Supports Claude Code, Cursor, Windsurf, and Copilot. Auto-detects from marker files or accepts an override.

**Input:** optional `framework` (`claude` | `cursor` | `windsurf` | `copilot`), optional `path` (project root)

Each step is idempotent — running on an already-initialized project reports what's present without overwriting.

## Development

```bash
npm install
npm run build
npm test
```
