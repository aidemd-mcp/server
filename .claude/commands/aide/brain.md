# /aide:brain — Brain Interface

General-purpose interface to the project's brain, plus a `config` mode for wiring the brain on first install (or repointing it at a different location).

The brain is backend-agnostic: it might be Obsidian today and something else tomorrow. The `aide_brain` MCP tool is the single source of truth for *which* MCP tools to call to reach this project's brain — never hardcode a backend tool name.

---

## Modes

`$ARGUMENTS` controls which mode runs:

- **`config`** (or `config <path>`) — run the brain wiring flow. Use this when `/aide` reports the brain isn't wired yet, or when you want to point at a different location.
- **Anything else (or no arguments)** — general brain interaction. Reach the brain via `aide_brain`, follow the entry-point file's navigation rules, and fulfill the user's request (search the brain, save findings, look up research, etc.).

---

## Mode 1: General Brain Interaction (default)

When `$ARGUMENTS` is empty or anything other than `config`, treat the call as a general brain query.

### Step 1 — Reach the brain via `aide_brain`

Call the `aide_brain` MCP tool. It returns ready-to-execute prose naming the exact MCP read tool wired to this project's brain and the path to the brain's entry-point file (the brain's `CLAUDE.md`). Execute those instructions verbatim — do not substitute a different read tool, do not invent a path.

That entry-point file is the single source of truth for brain structure — crawling protocol, decision protocol, and a where-to-find-things table. Read it before doing anything else.

### Step 2 — Follow the navigation instructions

Execute the navigation steps the brain's entry-point file provides to find the content relevant to the user's request. Do not supplement, override, or paraphrase those rules — defer to them entirely. As you crawl, use whichever search/read tool names `aide_brain` named in Step 1.

### Step 3 — Fulfill the user's request

Return what you found, or write what they asked you to write, synthesized in response to what they asked. If they asked you to save something, follow the brain's frontmatter and naming conventions for the area you're writing into. Use the write tool name from `aide_brain`'s prose.

### Rules

- **Call `aide_brain` first.** Do not assume a backend, do not hardcode a tool name, do not search or list directories before reaching `aide_brain`'s entry-point file.
- **Defer to the entry-point file's navigation rules.** Do not supplement, override, or paraphrase them.
- **Use the brain's MCP tools**, not native filesystem tools — brain content lives behind the MCP boundary, and the specific tool names come from `aide_brain`.

---

## Mode 2: Config — Wire the Brain (`/aide:brain config`)

When `$ARGUMENTS` starts with `config`, run the brain wiring flow. This is a thin router — it does not parse `$ARGUMENTS` or branch on backend identity. Every integration-specific decision (what arguments mean, how to ask the user, how to edit `brain.aide`, how to run sync) lives in the integration's `config` section inside `brain.aide`. This command retrieves that section and executes it verbatim.

### Step 1 — Call `aide_info`, branch on `brain.status`

Call `aide_info` and read `brain.status`.

- **`ok`** — `brain.aide` exists and `.mcp.json` is in sync. Forward `$ARGUMENTS` and fall through to Step 3. The integration's config prose decides what to do (typical case: re-point if `$ARGUMENTS` is non-empty, STOP otherwise).
- **`no-brain-aide`** — `brain.aide` does not exist. Continue to Step 2.
- **`no-mcp-entry`** / **`mcp-drift`** — `brain.aide` exists but `.mcp.json` is out of sync. Skip Step 2 and go directly to Step 3.

### Step 2 — Ensure `brain.aide` exists

Call `aide_init({ category: "brain" })` with **no** `brainPath` argument. The scaffold lands a `<BRAIN_PATH>` placeholder inside `mcpServerConfig.args`. After this call, `brain.aide` exists on disk and `aide_brain` can be called.

### Step 3 — Pull integration-specific config prose

Call `aide_brain({ kind: "config" })`. It returns the verbatim `<!-- aide-config-start -->` body section from the host's `brain.aide`. Forward `$ARGUMENTS` opaquely to the returned instructions — the shipped command does not parse it. The integration's prose alone interprets the bytes.

### Step 4 — Execute the returned instructions verbatim

Follow the instructions returned in Step 3 exactly. The integration's config prose owns everything from here: deciding what `$ARGUMENTS` means for this backend, asking the user for whatever else it needs (using `AskUserQuestion` plus `aide_info.brain.hints` when appropriate), editing `brain.aide` to land the resolved values, running sync via the Bash command recovered from `.mcp.json["mcpServers"]["aide"]`, and emitting the restart message.

### Step 5 — STOP

After Step 4 completes, **STOP**. Do NOT call `aide_info` again in the same session. The brain MCP server was launched before the new entry existed and cannot be hot-reloaded mid-session — an in-session re-check would report stale truth. Continuation always happens on the next `/aide` invocation after the user restarts Claude Code.

### Failure handling (Step 2 — scaffold only)

If the `aide_init` call in Step 2 throws or the scaffold fails, do NOT retry inline, do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong scaffolding `.aide/config/brain.aide`: `<error message>`.
>
> Run `npx aidemd-mcp init` in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

Sync failure is handled inside Step 4's verbatim instructions — the integration's prose owns the sync invocation and its error recovery.

---

## Arguments

`$ARGUMENTS` is forwarded verbatim to the integration's config prose (Step 3). The shipped command does not parse, validate, or interpret it. Each integration's `brain.aide` `config` section documents what users can put after `/aide:brain config` for that backend. Anything other than `config` (or empty) routes to Mode 1.
