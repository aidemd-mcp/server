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

**Every step below is mandatory.** Do not skip Step 3 because you think you know what `brain.status` means. `brain.status` is a status code, not a runbook. The runbook lives in the integration prose retrieved in Step 3, and it is the only authoritative source for what to do next. If you find yourself drafting "next steps" for the user from your own understanding of the status code, you have skipped Step 3 — go back and call `aide_brain({ kind: "config" })`.

### Step 1 — Call `aide_info`

Call `aide_info`. Read `brain.status` and `brain.hints`. Both fields are **informational only** — `brain.status` does NOT gate the next step, and `brain.hints` is a candidate path list the integration's prose may consult later when asking the user for a brain root. Do not branch on `brain.status`.

### Step 2 — Scaffold `brain.aide` if missing

Branch on `brain.status` from Step 1, but only for this scaffolding decision:

- **`brain.status === "no-brain-aide"`** → Call `aide_init({ category: "brain" })`. This scaffolds `.aide/config/brain.aide` from the bundled template, emitting YAML null at the unwired path slot of `mcpServerConfig.args`. YAML null is the structural unwired-slot signal; there is no literal-string placeholder.
- **Any other `brain.status` value** → Skip the `aide_init` call. `brain.aide` is already on disk; the integration prose in Step 3 will read it directly.

This is a presence-check branch, not a config-flow branch — it decides whether to scaffold, not what wiring path to take. Every other state distinction is owned by the integration prose returned in Step 3, which inspects `brain.aide` directly. Missing-`brain.aide` recovery still folds into this command via the `no-brain-aide` branch above; there is no separate `doctor`, `repair`, or `status` verb.

Missing entry-point artifact recovery is owned by the integration's prose's presence-check + re-seed loop in Step 4 — not by this call.

### Step 3 — Pull integration-specific config prose (MANDATORY)

Call `aide_brain({ kind: "config" })`. This call is mandatory and runs every time `/aide:brain config` is invoked, regardless of `brain.status`. It returns the verbatim `<!-- aide-config-start -->` body section from the host's `brain.aide`. Forward `$ARGUMENTS` opaquely to the returned instructions — the shipped command does not parse it. The integration's prose alone interprets the bytes.

You MUST NOT skip this call. The integration prose is the only source of truth for what to do with `brain.aide` and `.mcp.json`. `brain.status` from Step 1 is a coarse status code — notably, `no-mcp-entry` covers both unwired-args (YAML null at the path slot, never filled) and unsynced-args (string at the path slot, never written to `.mcp.json`) — and you cannot tell which sub-case applies without reading the integration prose and following its first step.

### Step 4 — Execute the returned instructions verbatim

Follow the instructions returned in Step 3 exactly. The integration's config prose owns everything from here: deciding what `$ARGUMENTS` means for this backend, asking the user for whatever else it needs (using `AskUserQuestion` plus `aide_info.brain.hints` when appropriate), editing `brain.aide` to land the resolved values into the YAML-null slots, running sync via the Bash command recovered from `.mcp.json["mcpServers"]["aide"]`, seeding the four entry-point artifacts into the brain via the brain's own MCP write tool from the seed-section bytes (presence-check + re-seed any missing), and emitting the restart message.

**Anti-patterns — each one means you have skipped or short-circuited the flow:**

- Telling the user to run `npx @aidemd-mcp/server@latest sync` themselves. Sync runs via your own Bash tool, recovered from `.mcp.json["mcpServers"]["aide"]` (`command` + `args` + `"sync"` appended). Telling the user to run it is a failure mode — they invoked `/aide:brain config` expecting the slash command to complete the wiring, not to hand them homework.
- Concluding `brain.aide` is wired or unwired without quoting the actual bytes at the path slot. The integration prose's first step instructs you to read and quote the value at the unwired slot before continuing — you cannot quote what you did not read.
- Treating `brain.status` as a runbook. It is a status code; the runbook is the integration prose. Drafting "next steps for the user" from the status code alone means you bypassed Steps 3–4.
- Comparing the integration prose against guidance outside it. The prose is the authority — follow it as written.
- Falling back to native filesystem tools (`Read`, `Write`, `Glob`, Bash `ls`, etc.) to inspect or write the brain when the brain MCP tools are not reachable. The brain is a backend-agnostic abstraction; the filesystem is one possible backing store but you must not assume it. If the brain MCP tools are unreachable, the correct response is to STOP and tell the user to restart, never to improvise via the filesystem.

### Step 5 — STOP

After Step 4 completes, **STOP**. Do NOT call `aide_info` again in the same session. The brain MCP server was launched before the new entry existed and cannot be hot-reloaded mid-session — an in-session re-check would report stale truth. Continuation always happens on the next `/aide` invocation after the user restarts Claude Code.

### Failure handling (Step 2 — scaffold only)

If the `aide_init` call in Step 2 throws or the scaffold fails, do NOT retry inline, do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong scaffolding `.aide/config/brain.aide`: `<error message>`.
>
> Run `npx @aidemd-mcp/server@latest init` in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

Sync failure and entry-point seeding failures are handled inside Step 4's verbatim instructions — the integration's prose owns those flows and their error recovery.

---

## Arguments

`$ARGUMENTS` is forwarded verbatim to the integration's config prose (Step 3). The shipped command does not parse, validate, or interpret it. Each integration's `brain.aide` `config` section documents what users can put after `/aide:brain config` for that backend. Anything other than `config` (or empty) routes to Mode 1.
