<!-- aide-methodology -->
## AIDE — Autonomous Intent-Driven Engineering

This project uses the AIDE methodology. AIDE treats a short `.aide` intent
spec living next to orchestrator code as the contract every downstream
agent (architect, implementor, QA) works from — when the intent changes,
the code changes.

The full canonical methodology is installed in this project at
`.aide/docs/`. Start at `.aide/docs/index.md` for the doc list, then
crawl into the specific canonical doc your current task requires. Read
only what the task actually needs — the doc directory is organized for
progressive disclosure, not for front-loading.

**Before writing, editing, or acting on any `.aide` file, crawl the doc directory
and read the canonical doc that governs the work you are about to do.**
Never guess AIDE rules from memory: the files under `.aide/docs/` are
the authoritative source, and any decision that disagrees with them is
wrong by definition.

**AIDE tools quick-reference:**
- `aide_discover` — map where `.aide` specs live in the project
- `aide_read` — read a specific `.aide` file with context
- `aide_scaffold` — create a new `.aide` file
- `aide_validate` — check spec layout for drift or issues
- `aide_init` — bootstrap AIDE into a new project (first-time setup)
- `aide_upgrade` — update/sync/refresh AIDE docs, commands, agents, and skills to the latest canonical versions (use this when asked to "update AIDE", "update the docs", or "sync the methodology")

**Invoking `/aide` and `/aide:*`:** when the user invokes any AIDE slash command, your **first action** must be to invoke the matching skill via the `Skill` tool — for `/aide`, that is `Skill(skill="aide", args=...)`. The slash-command file at `.claude/commands/aide.md` is a thin signpost; the orchestrator prose and the **MANDATORY BOOT SEQUENCE** live in the `aide` skill (`.claude/skills/aide/SKILL.md`). Do NOT attempt to handle the request from the command file alone, do NOT skip the skill, and do NOT respond to the user's request before the boot sequence completes — skipping boot means orchestrating a methodology you don't know.

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

## Local `.mcp.json` for the `aide` Server

This repo IS the `@aidemd-mcp/server` package. That breaks the obvious-looking npx form in local dev.

**Do NOT use** `npx @aidemd-mcp/server` as the `aide` server's launch command in this repo's `.mcp.json`. When `npm exec` runs from inside the package's own source directory, it sees the local `package.json` (whose `name` matches), treats the package as "already installed locally," skips the install step, and tries to invoke a bin from `./node_modules/.bin/` — which doesn't exist because THIS project IS the package. The failure surfaces as `'aidemd-mcp' is not recognized as an internal or external command`, which looks like a Windows PATH or scoped-package bin bug but isn't. It's an `npm-exec-from-source-dir` bug that only manifests in this one repo. Consumer projects running the same npx form work fine.

**Two working forms** for this repo's `.mcp.json`:

```json
// Option A — dev form, runs the local build
"aide": { "command": "node", "args": ["./dist/index.js"] }

// Option B — pulls from npm; cwd MUST be outside the project root
"aide": {
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@aidemd-mcp/server@latest"],
  "cwd": "C:\\Users\\<you>"
}
```

If `aide` MCP fails to register on this repo, check `.mcp.json` matches one of the two forms above before debugging anything else.

## Don't Run the Pipeline on the Agent Harness

This repo's primary work is editing `.claude/agents/`, `.claude/commands/`, and `.claude/skills/` — those ARE the canonical agent definitions, command prompts, and skill prompts that ship to host projects via `aide_init`. They are the runtime of the AIDE pipeline; running the pipeline *against* them is a circular dependency.

**Do NOT spawn `/aide` (spec → research → synthesize → plan → build → QA → fix) on `.claude/` files.** No per-agent or per-command `.aide` specs (e.g., `.claude/commands/aide/aide.aide`). When agent, command, or skill behavior needs to change, edit the canonical file directly.

`.aide/docs/`, `.aide/intent.aide`, and `.aide/config/brain.aide` ARE pipeline-appropriate — they describe code contracts and evolve alongside code changes. The rule applies specifically to the prompt/agent/skill definition surfaces under `.claude/`.
