# /aide:brain — Brain Vault Interface

General-purpose interface to the project's Obsidian brain vault, plus a `config` mode for wiring the brain on first install (or repointing it at a different vault).

---

## Modes

`$ARGUMENTS` controls which mode runs:

- **`config`** (or `config <path>`) — run the brain wiring flow. Use this when `/aide` reports the brain isn't wired yet, or when you want to point at a different vault.
- **Anything else (or no arguments)** — general vault interaction. Read the vault's root `CLAUDE.md`, follow its navigation rules, and fulfill the user's request (search notes, save findings, look up research, etc.).

---

## Mode 1: General Brain Interaction (default)

When `$ARGUMENTS` is empty or anything other than `config`, treat the call as general vault access.

### Step 1 — Read the vault's root `CLAUDE.md`

Use the Obsidian MCP to read the vault's root `CLAUDE.md`.

That file is the single source of truth for vault structure — crawling protocol, decision protocol, and a where-to-find-things table. Read it before doing anything else.

### Step 2 — Follow the navigation instructions

Execute the navigation steps the vault `CLAUDE.md` provides to find the content relevant to the user's request. Do not supplement, override, or paraphrase the vault's navigation rules — defer to them entirely.

### Step 3 — Fulfill the user's request

Return what you found, or write what they asked you to write, synthesized in response to what they asked. If they asked you to save something, follow the vault's frontmatter and naming conventions for the area you're writing into.

### Rules

- **Read the vault `CLAUDE.md` first.** Do not search, list directories, or read any other file before it.
- **Defer to the vault `CLAUDE.md`'s navigation rules.** Do not supplement, override, or paraphrase them.
- **Use the Obsidian MCP**, not native filesystem tools — vault content lives behind the MCP boundary.

---

## Mode 2: Config — Wire the Brain Vault (`/aide:brain config`)

When `$ARGUMENTS` starts with `config`, run the brain wiring flow. This is the single source for everything brain-wiring related — `/aide` does not duplicate any of this logic; it just routes here.

### Step 1 — Gather state

Call `aide_info` to read `brain.status`, `brain.vaultPath`, and `brain.hints`. Branch on `brain.status`:

- **`ok`** — vault is already wired and resolves on disk. Tell the user there's nothing to do. If `$ARGUMENTS` includes a path different from the configured one, treat that as a re-point and continue to Step 2 with the new path.

- **`no-mcp-entry`** — the obsidian MCP entry isn't in `.mcp.json` yet. Direct the user to bootstrap with the CLI first:

  > The obsidian MCP entry isn't in `.mcp.json` yet. Run `npx aidemd-mcp init` in this project's terminal — it'll add the obsidian shell and tell you what to do next. Then re-run `/aide:brain config`.

  STOP. Do not try to write `.mcp.json` from scratch here.

- **`invalid-path`** — the entry exists but the configured path is empty or doesn't resolve on disk. Continue to Step 2.

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

### Step 3 — Patch `.mcp.json` (mcp-category call)

Call `aide_init({ category: "mcp", brainPath: <brainPath> })`. The response is an `InitResult` filtered to mcp-category steps only. Find the step where `category === "mcp"` and `name` contains `"obsidian"`.

- **`status === "exists"`** — `.mcp.json` already points at `<brainPath>`. Skip the merge and continue to Step 4.

- **`would-create` / `would-overwrite` / `created` / `overwritten`** — the step carries a `prescription: { key, entry }`. Apply it:
  1. `Read` `.mcp.json`.
  2. Parse it and merge `prescription.entry` into `mcpServers[prescription.key]`, leaving every other `mcpServers` key untouched.
  3. `Write` the merged object back, preserving existing indentation (or two-space indent if the file is new).
  4. If `.mcp.json` does not exist, create it as `{ "mcpServers": { [prescription.key]: prescription.entry } }`.

**Never** call `Write` with the raw prescription as if it were the full config file — that would clobber the user's other MCP entries.

### Step 4 — Seed the vault (brain-category call)

Call `aide_init({ category: "brain", brainPath: <brainPath> })`. No prompt, no `AskUserQuestion`. Brain steps are seed-semantic — `"would-create"` (applied silently by the tool) or `"exists"` (already present). The tool writes directories and seed files itself.

### Step 5 — Tell the user to restart, then STOP

Steps 3 and 4 completed without throwing. Emit:

> `<brainPath>` wired up. `.mcp.json` patched and vault scaffolded.
>
> Restart Claude Code so the obsidian MCP server loads the new config, then re-run `/aide` and we'll pick up where we left off.

Then **STOP**. Do NOT re-call `aide_info`. Do NOT continue the user's original request. The obsidian MCP server in this session was launched with the old config and will not pick up the new path until Claude Code restarts. Continuation happens on the next `/aide` invocation.

### Failure handling

"Failure" means the `aide_init` mcp call threw, the `.mcp.json` merge threw (unreadable, unparseable, unwritable), or the `aide_init` brain call threw. Do NOT retry inline. Do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong wiring the vault path: `<error message>`.
>
> Run `npx aidemd-mcp init` in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

---

## Arguments

`$ARGUMENTS` —
- `config` to enter the wiring flow with hint-driven path resolution.
- `config <absolute-path>` to wire (or re-point) at an explicit path without prompting.
- Anything else (or empty) — treat as a general vault query/instruction.
