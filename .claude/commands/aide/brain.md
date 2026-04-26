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

`brain.aide` is the single editable file that owns the brain config. This mode scaffolds it when missing and routes `.mcp.json` mutation through the `npx aidemd-mcp sync` CLI verb — the only surface allowed to write `.mcp.json` directly.

### Step 1 — Gather state

Call `aide_info` to read `brain.status`, `brain.vaultPath`, and `brain.hints`. Branch on `brain.status`:

- **`ok`** — vault is already wired and resolves on disk. Tell the user there's nothing to do. If `$ARGUMENTS` includes a path different from the configured one, treat that as a re-point and continue to Step 2 with the new path. Otherwise **STOP**.

- **`no-brain-aide`** — `brain.aide` hasn't been scaffolded yet. Continue to Step 2 to resolve the vault path, then scaffold via `aide_init({ category: "brain", brainPath: <resolved> })`.

- **`mcp-drift`** — `brain.aide` exists and the path resolves, but `.mcp.json` is out of sync. Tell the user:

  > `brain.aide` is configured correctly but `.mcp.json` is out of sync. Run `npx aidemd-mcp sync` in your terminal to apply the config, then restart Claude Code and re-run `/aide`.

  **STOP.** Do not attempt to patch `.mcp.json` here.

- **`invalid-path`** — `brain.aide` exists but `rootPath` is empty or doesn't resolve on disk. Tell the user:

  > The vault path in `brain.aide` doesn't resolve. Open `.aide/brain.aide`, correct `rootPath` to an absolute path that exists on disk, save the file, then re-run `/aide`.

  **STOP.**

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

The resolved `<brainPath>` populates `rootPath` in the scaffolded `brain.aide` — it does NOT get written into `.mcp.json` directly.

### Step 3 — Scaffold `brain.aide` and route to sync

Call `aide_init({ category: "brain", brainPath: <brainPath> })`. This scaffolds `.aide/brain.aide` from the canonical default, with `rootPath` set to `<brainPath>`. No direct `.mcp.json` mutation happens here. Every `.mcp.json` mutation runs through a visible command boundary the user typed.

After scaffolding completes, tell the user:

> `brain.aide` scaffolded at `.aide/brain.aide` with your vault path.
>
> Run `npx aidemd-mcp sync` in your terminal to apply the config to `.mcp.json`. Then restart Claude Code so the brain MCP server picks up the new config, then re-run `/aide`.

Then **STOP**. Do NOT re-call `aide_info`. Do NOT continue the user's original request. The brain MCP server in this session was launched with the old config and will not pick up the new path until the user runs sync and restarts Claude Code. Continuation happens on the next `/aide` invocation.

### Step 4 — Seed the vault directories

Call `aide_init({ category: "brain", brainPath: <brainPath> })` to seed vault directories. Brain steps are seed-semantic — `"would-create"` (applied silently by the tool) or `"exists"` (already present). The tool writes directories and seed files itself. No prompt, no `AskUserQuestion`.

### Step 5 — Tell the user to sync and restart, then STOP

Steps 3 and 4 completed without throwing. Emit:

> `<brainPath>` configured in `brain.aide` and vault scaffolded.
>
> Run `npx aidemd-mcp sync` to apply the config to `.mcp.json`. Then restart Claude Code so the brain MCP server picks up the new config, then re-run `/aide` and we'll pick up where we left off.

Then **STOP**. Do NOT re-call `aide_info`. Do NOT continue the user's original request. Continuation happens on the next `/aide` invocation after the user runs sync and restarts.

### Failure handling

"Failure" means `aide_init` threw or the scaffold failed. Do NOT retry inline. Do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong scaffolding `brain.aide`: `<error message>`.
>
> Run `npx aidemd-mcp init` in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

---

## Arguments

`$ARGUMENTS` —
- `config` to enter the wiring flow with hint-driven path resolution.
- `config <absolute-path>` to wire (or re-point) at an explicit path without prompting.
- Anything else (or empty) — treat as a general vault query/instruction.
