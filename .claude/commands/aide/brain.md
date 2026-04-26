# /aide:brain — Brain Interface

General-purpose interface to the project's brain, plus a `config` mode for wiring the brain on first install (or repointing it at a different vault).

The brain is backend-agnostic: it might be Obsidian today and something else tomorrow. The `aide_brain` MCP tool is the single source of truth for *which* MCP tools to call to reach this project's brain — never hardcode a backend tool name.

---

## Modes

`$ARGUMENTS` controls which mode runs:

- **`config`** (or `config <path>`) — run the brain wiring flow. Use this when `/aide` reports the brain isn't wired yet, or when you want to point at a different vault.
- **Anything else (or no arguments)** — general brain interaction. Reach the brain via `aide_brain`, follow the entry-point file's navigation rules, and fulfill the user's request (search notes, save findings, look up research, etc.).

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

## Mode 2: Config — Wire the Brain Vault (`/aide:brain config`)

When `$ARGUMENTS` starts with `config`, run the brain wiring flow. This is the single source for everything brain-wiring related — `/aide` does not duplicate any of this logic; it just routes here.

`.aide/config/brain.aide` is the single editable file that owns the brain config. This mode scaffolds it when missing and routes `.mcp.json` mutation through the sync CLI binary — the only surface allowed to write `.mcp.json` directly.

### Step 1 — Gather state

Call `aide_info` and read three fields off `brain`: `brain.status`, `brain.name`, and `brain.hints`. Note that `brain.name` is absent on the `no-brain-aide` branch — that variant carries only `status` and `hints`. The other three variants (`ok`, `no-mcp-entry`, `mcp-drift`) all carry `name`; read it only when the branch is one of those three.

Branch on `brain.status`:

- **`ok`** — `.aide/config/brain.aide` exists and `.mcp.json` is in sync. Tell the user there's nothing to do. If `$ARGUMENTS` includes a path and that path represents a different vault from the one currently configured (surfaced by `brain.name` plus the user's own scaffolding history), treat that as a deliberate re-point and continue to Step 2 with the new path. Otherwise **STOP.**

- **`no-brain-aide`** — `.aide/config/brain.aide` does not exist yet. Continue to Step 2 to resolve the vault path, then to Step 3 to scaffold, then to Step 4 to run sync, then to Step 5.

- **`no-mcp-entry`** — `.aide/config/brain.aide` exists but `.mcp.json` has no `brain` key. Scaffolding is not needed. Skip Steps 2 and 3 and go directly to Step 4 to run sync, then Step 5.

- **`mcp-drift`** — `.aide/config/brain.aide` exists and `.mcp.json` has a `brain` key, but the key's `command`/`args` disagree with the `mcpServerConfig` declared in `brain.aide`. Sync will overwrite the entry to bring it back into alignment. Scaffolding is not needed. Skip Steps 2 and 3 and go directly to Step 4 to run sync, then Step 5.

### Step 2 — Resolve the vault path

If `$ARGUMENTS` was `config <path>`, use `<path>` as `<brainPath>` and skip to validation.

Otherwise, branch on `brain.hints.length`:

- **No hints** — ask inline:

  > Where is your brain vault? (Provide an absolute path.)

  Treat the user's reply as `<brainPath>`.

- **One or more hints** — call `AskUserQuestion`:
  - `header`: `"Brain vault"`
  - `question`: `"Where is your brain vault?"`
  - `options`: one entry per hint as `label: "Use {hint.path}"`, `description: "{hint.source} hint"`, **plus** an explicit final entry: `label: "Different location"`, `description: "Paste a custom absolute path"`. The explicit final entry is required (the schema's `minItems: 2` cannot be satisfied with a single hint, and the entry renders correctly for both 1-hint and multi-hint cases). Maximum 4 entries (3 hints + Different location); if hints exceed 3, drop the lowest-priority hint.

  **STOP. Wait for the user's response.**

  Resolve:
  - Hint clicked → extract the path from `"Use {hint.path}"`.
  - "Different location" / Other → use the user's typed text verbatim.

**Validate** `<brainPath>` is a non-empty absolute path. If it's relative or empty, ask once more inline for a corrected absolute path.

The resolved `<brainPath>` is passed to `aide_init` as `brainPath` in Step 3. `aide_init` lands it inline inside `mcpServerConfig.args` in the scaffolded `.aide/config/brain.aide` — it does NOT get written into `.mcp.json` directly.

### Step 3 — Scaffold `.aide/config/brain.aide`

Call `aide_init({ category: "brain", brainPath: <brainPath> })`. This scaffolds `.aide/config/brain.aide` from the canonical default, with `<brainPath>` landed inline inside `mcpServerConfig.args`. No direct `.mcp.json` mutation happens here. Every `.mcp.json` mutation runs through a visible command boundary — the agent's Bash call in Step 4 is the command the user sees in transcript.

### Step 4 — Run sync via Bash

This step runs unconditionally on the `no-brain-aide` path (after Step 3 completes), and also on the `no-mcp-entry` and `mcp-drift` paths (which skip directly here from Step 1).

Read the host project's `.mcp.json` and locate the `mcpServers["aide"]` entry. This entry is the launcher Claude Code itself uses to run the AIDE MCP server in the current session — its existence is guaranteed whenever this prompt is running. No defensive fallback prose is needed.

Take the entry's `command` and `args` exactly as written, append the literal string `"sync"` as the final argument, and run the resulting command via the Bash tool. The recovered command will look different depending on how AIDE was installed — for example:

- **Prod install** (illustrative): `cmd /c npx @aidemd-mcp/server sync`
- **Local-dev install** (illustrative): `node D:/path/to/dist/index.js sync`

These are examples only — they are not literal invocations hardcoded in this prompt. The launcher is always recovered from `.mcp.json["mcpServers"]["aide"]` at runtime; the actual command depends on the user's install shape.

**On success** (exit code 0): continue to Step 5.

**On failure** (exit code non-zero): surface the captured stderr to the user verbatim. Do NOT retry. Do NOT continue to Step 5. Tell the user:

> Sync exited with an error (see output above).
>
> Run `npx aidemd-mcp sync` manually in your terminal to see the full output, then restart Claude Code and re-run `/aide`.

### Step 5 — Emit the post-sync user message, then STOP

This step runs only after Step 4 returned exit code 0. Emit this message to the user:

> Sync wrote the brain entry into `.mcp.json` successfully.
>
> Please restart Claude Code so the brain MCP server picks up the new entry. Claude Code reads `.mcp.json` only at session startup, so the brain MCP server in the current session was launched before the brain entry existed and cannot be hot-reloaded mid-session. After the restart, re-running `/aide` will pick up where you left off.

Then **STOP**. Do NOT call `aide_info` again to "confirm" `brain.status: ok`. The brain MCP server in the running session was launched without the brain entry — `aide_info` in the same session reports disk state, not live-server state, and the resulting `ok` would be false confidence. Re-checking state in the same session is a trap; continuation always happens on the next `/aide` invocation after the restart.

Do NOT continue the user's original request. The live brain server is provably stale, and any work that touches it would hit an unwired backend.

### Failure handling (Step 3 — scaffolding only)

"Failure" here means the Step 3 `aide_init` call threw or the scaffold failed. The Bash-sync failure case from Step 4 is its own gate (handled inline in Step 4) and is not covered here. Do NOT retry inline. Do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong scaffolding `.aide/config/brain.aide`: `<error message>`.
>
> Run `npx aidemd-mcp init` in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

---

## Arguments

`$ARGUMENTS` —
- `config` to enter the wiring flow with hint-driven path resolution.
- `config <absolute-path>` to wire (or re-point) at an explicit path without prompting.
- Anything else (or empty) — treat as a general vault query/instruction.
