<!-- aide-methodology -->
## AIDE — Autonomous Intent-Driven Engineering

This project uses the AIDE methodology. AIDE treats a short `.aide` intent
spec living next to orchestrator code as the contract every downstream
agent (architect, implementor, QA) works from — when the intent changes,
the code changes.

The full canonical methodology is installed in this project at
`.aide/docs/`. Start at `.aide/docs/index.md` for the doc list, then
crawl into the specific canonical doc your current task requires. Read
only what the task actually needs — the hub is organized for
progressive disclosure, not for front-loading.

**Before writing, editing, or acting on any `.aide` file, crawl the hub
and read the canonical doc that governs the work you are about to do.**
Never guess AIDE rules from memory: the files under `.aide/docs/` are
the authoritative source, and any decision that disagrees with them is
wrong by definition.

<!-- aide-methodology -->

## Publishing

This package publishes to **npm** and the **MCP Registry** (registry.modelcontextprotocol.io).
A GitHub Actions workflow (`.github/workflows/publish.yml`) handles both automatically on `v*` tags.

**To publish a new version:**

```bash
node scripts/publish.mjs <patch|minor|major> [message]
```

This bumps `package.json`, syncs `server.json`, commits (e.g. `0.3.16: fix scoring tool`), tags `v0.3.16`, and pushes — the CI does the rest (npm publish + MCP Registry publish).

## Fixes Go in Canonical Docs, Not Memory

This project ships agent definitions (`.claude/agents/`), command prompts (`.claude/commands/`), and methodology docs (`.aide/docs/`) that get installed into other projects. When you discover a behavioral fix, pattern, or constraint that should apply to all agents or all projects using AIDE:

- **Write it into the canonical source** — the agent definition, command prompt, or methodology doc that governs the behavior.
- **Do NOT save it as a feedback memory.** Memory is private to this machine. Canonical docs ship with the package and apply everywhere.

The test: "Will other projects benefit from this fix?" If yes → canonical doc. If it's purely about how *this user* wants to interact → memory.
