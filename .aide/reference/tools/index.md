---
name: tools
description: Every MCP tool the @aidemd-mcp/server package exposes, one page per tool.
---

# AIDE MCP tools

The `@aidemd-mcp/server` package runs as an MCP server named `aide`. Agents call its tools as `mcp__aide__<tool>`; these pages drop the prefix. Each page says when to call the tool, what it takes, what it returns and what it guarantees.

| Tool | What it does |
|---|---|
| [aide_info](./aide_info.md) | Boot-time report: is the server behind, are the project's AIDE files or hooks out of date, is the brain wired. |
| [aide_discover](./aide_discover.md) | Maps where the project's `.aide` specs live, or one module's ancestor chain and subtree. |
| [aide_read](./aide_read.md) | Reads one `.aide` file with its type, sibling specs and links. |
| [aide_inspect](./aide_inspect.md) | Returns a code symbol's documentation, signature and kind without opening its file. |
| [aide_validate](./aide_validate.md) | Health check for the spec layout: orphaned or missing specs, plans with no spec, broken links. |
| [aide_scaffold](./aide_scaffold.md) | Creates a blank AIDE working file under its canonical name, never over an existing one. |
| [aide_frontmatter](./aide_frontmatter.md) | Reads or moves a spec's alignment or a plan, todo or brief's status. |
| [aide_cleanup](./aide_cleanup.md) | Removes a closed module's plan, todo and brief files. |
| [aide_brain](./aide_brain.md) | Reads one section of the brain config, the bundled template or the contract, or checks a draft config. |
| [aide_init](./aide_init.md) | Installs AIDE into a project, one category at a time. |
| [aide_upgrade](./aide_upgrade.md) | Finds where the project's AIDE files have drifted from the running version and applies what the user confirms. |
| [aide_observer_start](./aide_observer_start.md) | Starts the observer and halts if another session of the project is open. |
| [aide_observer_event](./aide_observer_event.md) | Reports one action of the session to the observer. |
| [aide_observer_end_session](./aide_observer_end_session.md) | Ends another open session of the project, after the user approves. |
