[![AIDE](https://img.shields.io/badge/AIDE-intent--driven-0D9488?style=flat&logo=markdown&logoColor=white)](https://github.com/aidemd-mcp/server)
[![CI](https://github.com/aidemd-mcp/server/actions/workflows/ci.yml/badge.svg)](https://github.com/aidemd-mcp/server/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@aidemd-mcp/server.svg)](https://www.npmjs.com/package/@aidemd-mcp/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![aidemd-mcp/server MCP server](https://glama.ai/mcp/servers/aidemd-mcp/server/badges/score.svg)](https://glama.ai/mcp/servers/aidemd-mcp/server)
[![npm downloads](https://img.shields.io/npm/dm/@aidemd-mcp/server.svg)](https://www.npmjs.com/package/@aidemd-mcp/server)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Discord](https://img.shields.io/discord/1496212051377262692?label=Discord&logo=discord)](https://discord.gg/N4NqMXuvTR)

# @aidemd-mcp/server

Open-source agentic SDLC framework for intent-driven, spec-driven development.
AIDE (aidemd) gives AI coding agents a production-grade software methodology
to follow, with skills, subagents and an MCP server whose tools work with a
cascading intent tree of `.aide` spec files. `brain.aide` is a
backend-agnostic plugin interface that connects your AIDE projects to a
central task board and coding playbook, so every agent follows your team's
conventions. It ships with an observer to manage running sessions and prevent
collisions between them.

Learn more at [aidemd.dev](https://aidemd.dev).

## Features

- **[Methodology docs](https://aidemd.dev/docs/)** — the AIDE methodology installed into your project, so every agent works from the same rules for specs, plans, QA and the intent tree
- **[Skills and subagents for each phase](https://aidemd.dev/learn/claude-code-subagents-pipeline/)** — `/aide` drives spec → research → synthesize → plan → build → QA → fix, handing each phase to its own specialized agent with a fresh context
- **[MCP toolkit](https://aidemd.dev/docs/tools/)** — tools that let agents map, read, scaffold and validate the cascading intent tree of `.aide` spec files and keep every file in its canonical format
- **[The brain](https://aidemd.dev/brain/)** — `brain.aide` connects your projects to a central task board and coding playbook on the backend you choose, so agents follow your team's conventions
- **[The observer](https://aidemd.dev/observer/)** — a local page showing every project's live sessions and pipeline progress, allowing one open session per project so sessions never collide
- **[Claude Code hooks](https://aidemd.dev/docs/hooks/)** — report each session's activity and end to the observer, so it always knows which sessions are really running

New to the ideas behind it? Read about [intent-driven engineering](https://aidemd.dev/learn/intent-driven-engineering/), [spec-driven vs intent-driven development](https://aidemd.dev/learn/spec-driven-vs-intent-driven-development/), [spec-kit alternatives](https://aidemd.dev/learn/spec-kit-alternatives/), [MCP servers for development workflow](https://aidemd.dev/learn/mcp-server-for-development-workflow/) and [AIDE as an open-source agentic SDLC framework](https://aidemd.dev/learn/open-source-agentic-sdlc-framework/).

## Installation

### Quick Start (Claude Code)

Run the installer from your project's root:

```bash
npx -y @aidemd-mcp/server@0.20.3 init
```

This command:

- Installs the AIDE MCP server globally (`npm i -g @aidemd-mcp/server`); if the install fails, it says so and writes nothing
- Merges the AIDE MCP server entry into `.mcp.json`, launched by its global command `aidemd-mcp`
- Writes the bundled brain config template to `.aide/config/brain.aide` (the brain location stays unset until `/aide:brain config` fills it and writes the brain MCP entry)
- Writes every pipeline slash command to `.claude/commands/aide/`
- Installs 11 canonical agents to `.claude/agents/aide/` (the pipeline agents plus `aide-upgrader`, which `/aide:upgrade` runs to migrate the project's own files) and the `kanban-maintainer` board agent to `.claude/agents/kanban/`
- Installs skills (`study-playbook`, `brain`, `aide`, `aide-handoff`, `kanban`, `aide-brain-author`) to `.claude/skills/`
- Installs the methodology docs hub to `.aide/docs/`
- Writes the `aide-tree` launcher to `.aide/bin/aide-tree.mjs`
- Adds an AIDE badge to `README.md` (appends if not present)

All operations are additive — files that already exist are never overwritten. Safe to re-run at any time.

`init` asks for no brain location, path or token, and rejects backend flags such as `--vault-path`. `--brain <integration>` picks the bundled template (today only `obsidian`, the default).

After running, open Claude Code and run `/aide`. On the first run it routes to `/aide:brain config`, which fills the brain location in `.aide/config/brain.aide`, writes the brain MCP entry through sync, and seeds the brain. Anything else `init` could not finish is named in its closing follow-up list.

### Syncing brain.aide to .mcp.json

Run this after editing `.aide/config/brain.aide` — for example, when you update the brain path argument in `mcpServerConfig.args` or rename the brain in the `name` field:

```bash
aidemd-mcp sync
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

Install once, then register:

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

> [!NOTE]
> The Quick Start command above handles this automatically for Claude Code users.

#### Claude Desktop

Config file locations:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

After `npm i -g @aidemd-mcp/server`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

> [!NOTE]
> Claude Desktop does not inherit the terminal PATH. If you use nvm or Homebrew to manage Node, `aidemd-mcp` may not be found. Run `which aidemd-mcp` in your terminal to get the absolute path and use it as the command in the config above.

Claude Desktop requires a full quit-and-reopen after any config change.

#### Cursor

Add to `~/.cursor/mcp.json`:

After `npm i -g @aidemd-mcp/server`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

#### VS Code / Copilot

Add to `.vscode/mcp.json`:

After `npm i -g @aidemd-mcp/server`:

```json
{
  "servers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

> [!NOTE]
> VS Code / Copilot uses `"servers"` as the root key, not `"mcpServers"`. Using the wrong root key causes the server to silently fail to load.

#### Windsurf

Add to `~/.windsurf/mcp.json`:

After `npm i -g @aidemd-mcp/server`:

```json
{
  "mcpServers": {
    "aide": {
      "command": "aidemd-mcp"
    }
  }
}
```

## Tools

<!-- aide-tools:start -->
- [`aide_info`](https://aidemd.dev/docs/tools/aide_info/) — Boot-time report telling the orchestrator whether the server is behind, whether the project's AIDE files or hooks are out of date, and whether the brain is wired.
- [`aide_discover`](https://aidemd.dev/docs/tools/aide_discover/) — Maps where the project's .aide specs live, or gives one module's ancestor chain and subtree, so agents read intent before code.
- [`aide_read`](https://aidemd.dev/docs/tools/aide_read/) — Reads one .aide file and returns its content with its type, the other specs in its folder and the links it contains.
- [`aide_inspect`](https://aidemd.dev/docs/tools/aide_inspect/) — Returns a code symbol's documentation, signature and kind without opening the whole source file.
- [`aide_validate`](https://aidemd.dev/docs/tools/aide_validate/) — Health check for the spec layout, reporting orphaned or missing specs, plans with no spec, naming conflicts, broken links and frontmatter problems.
- [`aide_scaffold`](https://aidemd.dev/docs/tools/aide_scaffold/) — Creates a blank AIDE working file under its canonical name, from intent specs to plans, todo lists and the session record, never over an existing file.
- [`aide_frontmatter`](https://aidemd.dev/docs/tools/aide_frontmatter/) — Reads or moves a governed frontmatter value, a spec's alignment or a plan, todo or brief's status, leaving every other byte of the file untouched.
- [`aide_cleanup`](https://aidemd.dev/docs/tools/aide_cleanup/) — Removes a closed module's pipeline files (plan.aide, todo.aide, brief.aide), refusing while any of them is still open.
- [`aide_brain`](https://aidemd.dev/docs/tools/aide_brain/) — Read-only entry point to the brain config, returning one section of the host's config or the bundled template, the section contract, or a structural check of a draft config.
- [`aide_init`](https://aidemd.dev/docs/tools/aide_init/) — Installs AIDE into a project one category at a time, writing new files itself and asking before anything is overwritten.
- [`aide_upgrade`](https://aidemd.dev/docs/tools/aide_upgrade/) — Finds where the project's AIDE files have drifted from the version it runs and applies, one category at a time, only what the user confirms.
- [`aide_observer_start`](https://aidemd.dev/docs/tools/aide_observer_start/) — Starts the observer, or reuses the running one, and halts the session if another session of the same project is open.
- [`aide_observer_event`](https://aidemd.dev/docs/tools/aide_observer_event/) — Reports one action of the session to the observer, recorded first in the session's own log outside the project and then shown live.
- [`aide_observer_end_session`](https://aidemd.dev/docs/tools/aide_observer_end_session/) — Ends another open session of the project after the user approves, so a HALT can be cleared.
<!-- aide-tools:end -->

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
