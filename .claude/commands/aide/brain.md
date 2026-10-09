# /aide:brain — Brain Interface

General-purpose interface to the project's brain, plus a `config` mode that creates, repairs and wires the brain config (or repoints it at a different location).

The brain is backend-agnostic: it might be Obsidian today and something else tomorrow. The `aide_brain` MCP tool is the single source of truth for *which* MCP tools to call to reach this project's brain — never hardcode a backend tool name.

---

## Modes

`$ARGUMENTS` controls which mode runs:

- **`config`** (or `config <path>`) — create, repair, validate and wire the brain config. Use this when `/aide` reports the brain config is missing, invalid or not wired yet, or when you want to point at a different location.
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

## Mode 2: Config — Create, Repair, Validate and Wire (`/aide:brain config`)

When `$ARGUMENTS` starts with `config`, run this flow. It owns every brain config state: creating a missing `.aide/config/brain.aide` for any backend, repairing one that is missing required sections, validating the result, then wiring and seeding the brain.

**This command never lists the brain config's sections itself.** The required sections — their markers, purposes, roles (`live` or `seed`) and seed paths — are a published contract. Read them from `brainContract` on the `aide_init` step named `Brain config (brain.aide)`. Never write a section list from memory.

**Every step below is mandatory and runs in order.** `brain.status` is a status code, not a runbook. If you find yourself drafting "next steps" for the user from your own understanding of a status code, you have skipped a step — go back.

**Reading the contract and the repair prescription.** Call `aide_init` with **no arguments**. That is a read-only summary call; it writes nothing. Find the step named `Brain config (brain.aide)` and read `brainContract` (always present) and `brainRepair` (present only when the config is missing sections) from it.

### Step 1 — Call `aide_info`

Call `aide_info`. Read `brain.status`, `brain.fault` (present only on `brain-aide-invalid`) and `brain.hints` (candidate brain-root paths the config prose may offer the user later). The status picks the branch:

- `no-brain-aide` — the file is missing → Step 2 (CREATE).
- `brain-aide-invalid` — the file is present but falls short → Step 3 (REPAIR).
- `ok`, `no-mcp-entry` or `mcp-drift` → skip to Step 6 (WIRING/SEEDING).

### Step 2 — CREATE (status `no-brain-aide`)

1. **Ask which backend.** Use `AskUserQuestion`: the bundled default (Obsidian) or another backend. If another, ask which one and how its MCP server is launched.
2. **Scaffold.** Call `aide_init({ category: "brain" })`. It writes `.aide/config/brain.aide` from the latest bundled template, with YAML null at the unwired path slot of `mcpServerConfig.args`. YAML null is the structural unwired-slot signal; there is no literal-string placeholder.
3. **Non-Obsidian backend only — adapt the scaffold.** The bundled template is written for Obsidian, seed sections included: its seeds use Obsidian wiki links, the board plugin's frontmatter and trailing settings block, and the Obsidian brain tool names. None of that carries over to another backend, so every seed section needs adapting, not only the generic ones. Read `brainContract` from the summary call, then edit `.aide/config/brain.aide`:
   - **Frontmatter launcher.** Rewrite `name` and `mcpServerConfig` (`command`, `args`) for the user's backend. Leave YAML null at the slot the user's brain location fills. Add no other frontmatter field — the parser rejects extras.
   - **Live sections** (`role: "live"`). Rewrite each section's body so it fulfills its contract `purpose` for this backend: the backend's own tool names, entry points and wiring flow.
   - **Seed sections** (`role: "seed"`). Walk every one of them, one at a time: show the user the section's marker and purpose, rewrite its link syntax, frontmatter, board format and tool names for the user's backend, and confirm with the user before moving on.
   - Keep every marker line byte-identical and every section in place. Only the bytes between a section's markers change.

Then go to Step 4.

### Step 3 — REPAIR (status `brain-aide-invalid`)

Branch on `brain.fault.kind`.

**`missing-sections`:**

1. Call `aide_init` with no arguments and read `brainRepair` from the `Brain config (brain.aide)` step. Each entry carries the contract fields (`marker`, `purpose`, `role`, and `seedPath` for seeds), plus `block` — the full marker-wrapped section from the latest bundled template — and `insertAfter`.
2. Show the user the marker and purpose of each missing section, then confirm with `AskUserQuestion` (repair now / skip). On skip, STOP.
3. **Adapt every block on a non-Obsidian config first.** If this config's frontmatter launcher is not the bundled Obsidian one, every template block — live and seed alike — is Obsidian-specific (wiki links, the board plugin's frontmatter and settings, Obsidian brain tool names). Adapt each one with the user before inserting it:
   - **Live blocks** (`role: "live"`): rewrite the bytes between the markers so the section fulfills its contract `purpose` for this backend — the backend's own tool names, entry points and wiring flow.
   - **Seed blocks** (`role: "seed"`): walk them one at a time. Show the user the marker and purpose, adapt the bytes between the markers for this backend, and confirm with the user before moving to the next.
   - Keep both marker lines of every block byte-identical; only the bytes between them change.

   On the bundled Obsidian launcher, insert every block as given.
4. **Insert, and change nothing else.** Edit `.aide/config/brain.aide`, applying the entries in array order:
   - `insertAfter` is a close-marker string → insert `"\n\n" + block` immediately after the first occurrence of that exact string.
   - `insertAfter` is `null` → insert `block + "\n\n"` at the start of the body, immediately after the line holding the frontmatter's closing `---`.

   No other byte of the file changes. Never rewrite the file wholesale, never reorder or reformat existing sections, never touch the frontmatter.

Then go to Step 4.

**`malformed`:** show the user `brain.fault.reason` verbatim and help them fix that specific fault by hand — point at the offending lines and propose the minimal edit. Do not regenerate the file from the template; that would destroy their wiring and customizations. Once the user has fixed it, go to Step 4.

### Step 4 — VALIDATE

Call `aide_info` again. This is a parser check of the file on disk, not a brain query, so it is safe mid-session.

- `brain.status` is `no-brain-aide` or `brain-aide-invalid` → the config is still not valid. Show the status and `brain.fault`, return to Step 2 or Step 3, and do not continue.
- Any other status → continue to Step 5.

### Step 5 — SEED (sections added by a repair)

For each `role: "seed"` entry you inserted in Step 3, write it to its `seedPath` in the brain:

- **Brain MCP tools loaded in this session:** presence-check `seedPath`; a missing folder means the file is absent. If it exists, skip it — never overwrite user-edited content. If absent, take the bytes between that section's markers in `brain.aide`, drop the empty lines at their start and end, and write them to `seedPath` with the brain's write tool. When those bytes open with a `---` frontmatter block, pass that block in whatever form the write tool expects for frontmatter (for example a separate frontmatter argument), and pass only the text after its closing `---` (leading empty lines dropped) as the body. Never leave a frontmatter block inside the body text, or the file will not get real frontmatter.
- **Brain MCP tools not loaded:** tell the user the new seed files will be written once they restart Claude Code and re-run `/aide:brain config`. Never fall back to native filesystem tools to write the brain.

After a CREATE, skip this step — Step 6's config prose seeds every seed section.

### Step 6 — WIRING/SEEDING

Get the backend's config prose, then execute it verbatim:

- **`brain.status` is `ok`** → call `aide_brain({ kind: "config" })`. It returns the section of `.aide/config/brain.aide` that holds the contract's config entry, verbatim.
- **Any other status (e.g. `no-mcp-entry`, `mcp-drift`)** → `aide_brain` returns remediation prose there, not the section. Derive the section's markers from the contract, then read the file directly:
  1. In `brainContract` (from the `aide_init` summary step `Brain config (brain.aide)`), take the contract's config entry — the `role: "live"` entry whose `purpose` is the backend's wiring and seeding flow this command runs.
  2. Build its markers from that entry's `marker` value with the marker grammar: the open marker is an HTML comment whose text is `aide-<marker>-start`, and the close marker is an HTML comment whose text is `aide-<marker>-end`.
  3. Read `.aide/config/brain.aide` and take the bytes between those two marker lines.

Forward `$ARGUMENTS` opaquely to that prose — this command does not parse it. The prose owns everything from here: what `$ARGUMENTS` means for this backend, asking the user for the brain location (`AskUserQuestion` plus `aide_info.brain.hints` when appropriate), landing the resolved value into the YAML-null slot, running sync via the Bash command recovered from `.mcp.json["mcpServers"]["aide"]`, seeding each seed section in the published contract (skip-on-exists), and emitting the restart message.

`no-mcp-entry` covers both unwired args (YAML null at the path slot) and unsynced args (a string at the path slot never written to `.mcp.json`). Only the prose's first step tells you which applies.

**Anti-patterns — each one means you have skipped or short-circuited the flow:**

- Telling the user to run `npx @aidemd-mcp/server@latest sync` themselves. Sync runs via your own Bash tool, recovered from `.mcp.json["mcpServers"]["aide"]` (`command` + `args` + `"sync"` appended). The user invoked `/aide:brain config` expecting it to complete the wiring, not to hand them homework.
- Concluding `brain.aide` is wired or unwired without quoting the actual bytes at the path slot. The prose's first step reads and quotes that value — you cannot quote what you did not read.
- Treating `brain.status` as a runbook, or acting on `aide_brain`'s remediation prose as if it were the config section.
- Listing, restating or inventing the brain config's sections instead of reading `brainContract` / `brainRepair`.
- Rewriting, reordering or reformatting existing sections during a repair.
- Comparing the config prose against guidance outside it. The prose is the authority — follow it as written.
- Falling back to native filesystem tools (`Read`, `Write`, `Glob`, Bash `ls`, etc.) to inspect or write the **brain** when the brain MCP tools are unreachable. The brain is backend-agnostic; if its tools are unreachable, STOP and tell the user to restart. (Editing `.aide/config/brain.aide` is fine — it is a project file, not the brain.)

### Step 7 — STOP

After Step 6 completes, **STOP**. Do NOT call `aide_info` again in this session. The brain MCP server was launched before the new entry existed and cannot be hot-reloaded mid-session — an in-session re-check after sync would report stale truth. Continuation happens on the next `/aide` invocation after the user restarts Claude Code.

### Failure handling (`aide_init` scaffold)

If the `aide_init({ category: "brain" })` call in Step 2 throws or the scaffold fails, do NOT retry inline, do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong scaffolding `.aide/config/brain.aide`: `<error message>`.
>
> Run `npx @aidemd-mcp/server@latest init` in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

Sync and brain-seeding failures inside Step 6 are owned by the config prose and its own error recovery.

---

## Arguments

`$ARGUMENTS` is forwarded verbatim to the integration's config prose (Mode 2, Step 6). The shipped command does not parse, validate, or interpret it. Each integration's `brain.aide` `config` section documents what users can put after `/aide:brain config` for that backend. Anything other than `config` (or empty) routes to Mode 1.
