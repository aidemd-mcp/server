# Brain Config + Update-Playbook Rework — Proposal

Move integration-specific orchestration out of two shipped surfaces — `.claude/commands/aide/brain.md` Mode 2 (config) and `.claude/commands/aide/update-playbook.md` — and into `brain.aide`. The two follow *different* patterns because they sit at different points in the lifecycle:

- **`config`** lives in `brain.aide` *forever* and is read live by `aide_brain` whenever `/aide:brain config` runs. It cannot live in the brain because it's read before the brain is wired.
- **`update-playbook`** is an install-time *seed* that lands as a file inside the brain. After install, the brain owns the file; users edit it there. The shipped command is a thin pointer to the on-disk brain file (same pattern as `study-playbook`).

The shipped `.claude/commands/aide/brain.md` and `.claude/commands/aide/update-playbook.md` become thin routers / pointers; per-integration UX (Obsidian, Notion, etc.) lives in the user-owned `brain.aide` template or in the brain itself.

---

## Two patterns, one rule

`brain.aide` body sections split into two categories by *who reads them*:

**Live agent-facing (read by `aide_brain` at runtime):**
- `orientation` — runtime briefing
- `config` — bootstrap wiring flow

These sections live in `brain.aide` permanently. `aide_brain({ kind })` returns them verbatim on demand. Changes only happen when the user edits `brain.aide`.

**Install-time seeds (read by the install service once, written into the brain as files):**
- `playbook-index` → `coding-playbook/coding-playbook.md`
- `study-playbook` → `coding-playbook/study-playbook.md`
- `update-playbook` → `coding-playbook/update-playbook.md` ← **new**
- `research-index` → `research/research.md`

Once the install service writes these files into the brain, the brain owns them. Users edit them in the brain. The brain.aide section bytes go dormant — they only matter on a fresh re-init into an empty brain root.

This is why `update-playbook` doesn't get an `aide_brain` `kind`: after install, the live source is the brain file, not brain.aide. The shipped command points at the file directly (same shape as `study-playbook` skill).

---

## New `.claude/commands/aide/brain.md` Mode 2 flow

Five steps. The shipped command is a thin router that knows nothing about argument shape — every parameter (paths, tokens, ids, anything else) is integration-specific and lives in `brain.aide`'s `config` section.

1. **`aide_info`** — branch on `brain.status`.
   - `ok` → fall through with `$ARGUMENTS` forwarded; the integration's prose decides whether there's anything to do (typical case: re-point if `$ARGUMENTS` is non-empty, STOP otherwise).
   - `no-brain-aide` → go to Step 2.
   - `no-mcp-entry` / `mcp-drift` → skip Step 2, go to Step 3.

2. **Ensure `brain.aide` exists.** Call `aide_init({ category: "brain" })` with **no** `brainPath`. The default scaffold lands a placeholder (e.g., `<BRAIN_PATH>`) inside `mcpServerConfig.args`. After this, `brain.aide` exists on disk and `aide_brain` can be called.

3. **Pull integration-specific config prose.** Call `aide_brain({ kind: "config" })`. Returns the verbatim `<!-- aide-config-start -->` body section. Forward `$ARGUMENTS` opaquely — the shipped command does not parse it. The integration's prose alone interprets the bytes (path, token, token+id, JSON blob, whatever).

4. **Execute the returned instructions verbatim.** The integration's config prose owns: deciding what `$ARGUMENTS` means for this backend, asking the user for whatever else it needs (`AskUserQuestion` + `aide_info.brain.hints` when appropriate), editing `brain.aide` to land the resolved values, running sync via the Bash command recovered from `.mcp.json["mcpServers"]["aide"]`, emitting the restart message.

5. **STOP.** Same "don't re-call `aide_info` in the same session" trap as today.

The shipped command's docs **cannot** list parameter shapes — there are none at the shipped layer. `$ARGUMENTS` is a forwarded string. The integration's `config` section is the only place that documents what users can put after `/aide:brain config`.

---

## New `.claude/commands/aide/update-playbook.md` flow

One step. Mirrors the existing `study-playbook` skill pattern exactly.

> Call `aide_brain` once. Following the brain access instructions it returns, read `coding-playbook/update-playbook.md` and follow the playbook-maintenance methodology it describes.

Done. The shipped command file is essentially that one paragraph plus framing. The Obsidian-flavored prose, the `mcp__brain__patch_note` tool names, the routing-table drift-detection mechanics — all of it lives in the brain at `coding-playbook/update-playbook.md`, sourced from the new `update-playbook` brain.aide section at install time.

After install, the user edits `coding-playbook/update-playbook.md` in their brain to refine the methodology. The brain.aide `update-playbook` section is the *seed*, not the live source.

---

## `brain.aide` schema change

Section names should say *what they are*, not just *what's in them*. Three renames + two new sections. Fixed body order becomes:

1. `orientation` ← **renamed from `prose`** — the agent's runtime briefing: what the brain is, what tools to call to read it, the four entry-point files it contains, and how those fit into the agent's workflow.
2. `config` ← **new** — integration-specific wiring flow. Used by `/aide:brain config` only. Read live via `aide_brain`.
3. `playbook-index` ← **renamed from `playbook`** — install-time seed for the coding-playbook entry-point artifact (`coding-playbook/coding-playbook.md`). The "index" suffix calls out that this section seeds the *index* of the playbook, not the playbook content itself.
4. `study-playbook` ← **renamed from `studyPlaybook`** (marker spelling now matches typed key after kebab-to-camel) — install-time seed for the study-playbook navigation guide (`coding-playbook/study-playbook.md`). Not an index — it's the methodology for *reading* the playbook index.
5. `update-playbook` ← **new** — install-time seed for the playbook-maintenance methodology (`coding-playbook/update-playbook.md`). Sibling of `study-playbook`: same parent directory, same shape (a methodology file, not an index).
6. `research-index` ← **renamed from `research`** — install-time seed for the research entry-point artifact (`research/research.md`). Same "index" framing as `playbook-index`.

Order rationale: agent-facing live sections (1-2) first, then install-time seeds (3-6) grouped by directory (`coding-playbook/*` then `research/*`).

New / renamed marker pairs (paired open/close, lowercase, exact spacing — same grammar rules as today):

| # | Marker pair | Typed result key | Consumer | Status |
|---|---|---|---|---|
| 1 | `<!-- aide-orientation-start -->` / `<!-- aide-orientation-end -->` | `orientation` | `aide_brain` (live) | renamed from `prose` |
| 2 | `<!-- aide-config-start -->` / `<!-- aide-config-end -->` | `config` | `aide_brain` (live) | new |
| 3 | `<!-- aide-playbook-index-start -->` / `<!-- aide-playbook-index-end -->` | `playbookIndex` | install (seed) | renamed from `playbook` |
| 4 | `<!-- aide-study-playbook-start -->` / `<!-- aide-study-playbook-end -->` | `studyPlaybook` | install (seed) | unchanged |
| 5 | `<!-- aide-update-playbook-start -->` / `<!-- aide-update-playbook-end -->` | `updatePlaybook` | install (seed) | new |
| 6 | `<!-- aide-research-index-start -->` / `<!-- aide-research-index-end -->` | `researchIndex` | install (seed) | renamed from `research` |

Strict-failure migration: pre-rework files (4 sections with `aide-prose-*` / `aide-playbook-*` / `aide-research-*` markers) return `malformed-body` naming all expected new markers as missing. No transitional read path, no auto-injection, no rename rewrite — same policy as the prior 3→4 amendment. Hosts hand-edit: rename their existing markers to the new names and paste `config` + `update-playbook` sections.

---

## `aide_brain` API change

```ts
aide_brain({ kind?: "orientation" | "config" })
```

- `kind` defaults to `"orientation"` — the rename of today's default-prose return.
- `kind === "config"` returns the new `config` body section verbatim.
- Non-ok branches (`no-brain-aide`, `no-mcp-entry`, `mcp-drift`) unchanged — same fixed remediation prose, regardless of `kind`.

`update-playbook` is **not** an `aide_brain` kind — that section is install-time seed, not live. After install the agent reads `coding-playbook/update-playbook.md` from the brain itself, just like `study-playbook` works today.

Per-consumer ownership: `aide_brain` reads `orientation` and `config` only; install service reads `playbookIndex` / `studyPlaybook` / `updatePlaybook` / `researchIndex` only.

---

## Default Obsidian `orientation` section update

The current orientation lists three brain entry-point files. Add the fourth:

> Your brain is an Obsidian-backed knowledge store. Use `mcp__brain__read_note` to open files by their brain-relative path. Use `mcp__brain__search_notes` for keyword queries across every note in the store. The store has four entry-point artifacts: the coding-playbook index at `coding-playbook/coding-playbook.md`, the study-playbook navigation guide at `coding-playbook/study-playbook.md`, the update-playbook maintenance guide at `coding-playbook/update-playbook.md`, and the research index at `research/research.md`. Start from the relevant entry-point for your task, follow the references it lists to deepen context, and check those files' references too. Stay in scope; don't follow references into unrelated topics.

---

## Default Obsidian `config` section content

Prose-driven. No new frontmatter schema. This section is where Obsidian's argument shape (`/aide:brain config <absolute-path>`) is documented — at the integration layer, not the shipped command. Reads roughly:

> You are completing the wiring of an Obsidian brain. The required value is the absolute path to the user's Obsidian vault, landed as the last entry of `mcpServerConfig.args` in `brain.aide`.
>
> Argument shape (Obsidian only): `/aide:brain config [<absolute-path>]`. When `$ARGUMENTS` is non-empty, treat it as the absolute path the user wants to wire (initial wiring) or re-wire to (re-point). Empty `$ARGUMENTS` means "ask interactively" on a fresh wire and "STOP, nothing to do" against an already-wired brain.
>
> 1. Read `brain.aide`. Extract the current path entry from `mcpServerConfig.args` (the literal `<BRAIN_PATH>` placeholder means un-wired; any other string means already wired).
> 2. Decide the target path:
>    - `$ARGUMENTS` non-empty → use it as the target path.
>    - `$ARGUMENTS` empty AND current entry is `<BRAIN_PATH>` → ask the user where their vault lives. Use `AskUserQuestion` with `aide_info.brain.hints` as suggestions plus a "Different location" entry.
>    - `$ARGUMENTS` empty AND current entry is a real path → STOP, nothing to do.
> 3. Edit `brain.aide` — replace the current entry with the target path.
> 4. Sync — read `.mcp.json["mcpServers"]["aide"]`, take its command and args, append `"sync"`, run via Bash. On exit 0 continue; on non-zero surface stderr and stop.
> 5. Emit the restart message verbatim: "Sync wrote the brain entry. Restart Claude Code so the brain MCP server picks up the new entry, then re-run /aide."

A different integration's `config` section would document a completely different argument shape — e.g., a Notion brain might say "`$ARGUMENTS` is interpreted as a JSON object with `token` and `pageId` keys" or "`$ARGUMENTS` is the API token; pageId is always asked interactively." The shipped command doesn't care which.

---

## Default Obsidian `update-playbook` section content

The section seeds `coding-playbook/update-playbook.md` in the brain. Reads roughly:

> # Update Playbook
>
> Maintenance methodology for the coding playbook. Use `mcp__brain__read_note` to read entries, `mcp__brain__patch_note` or `mcp__brain__write_note` to edit them. Playbook entries live under `coding-playbook/<section>/`; the index sits at `coding-playbook/coding-playbook.md`.
>
> 1. Identify the change — new convention, modification to an existing one, section rename, section removal, or general audit. Skip this step if the user already named the change.
> 2. Read `coding-playbook/coding-playbook.md` to identify the relevant section, or confirm no section yet exists for a new convention.
> 3. Apply the change with `mcp__brain__patch_note` or `mcp__brain__write_note`. If a section was added, renamed, or removed, offer to reorganize adjacent sections under a new or updated domain grouping if it would improve navigability.
> 4. **Routing-table drift check (required):** Compare the playbook entry-point's task routing table against the actual sections that now exist. For each row: does the section it points to still exist under that name? For each section: does the routing table cover it? Offer to reconcile any drift.
> 5. Apply any routing-table changes the user approves. Confirm the final state — what was changed in the playbook, what was changed in the routing table.

After install this content lives in the brain at `coding-playbook/update-playbook.md`. The user edits it there.

### Why the prose-driven seed pattern

The prose is integration-specific by design — Obsidian asks for one path; Notion asks for an API token + page ID; the playbook editor for Obsidian uses `mcp__brain__patch_note` while a Notion brain calls a different API. Forcing every backend into uniform schemas rebuilds the in-code backend registry the architecture rejects. The new sections *are* the per-integration param lists and edit recipes, expressed in their natural shape — for `config` they're read live, for `update-playbook` they seed a brain file the user can subsequently edit.

---

## Bootstrap consequences

- `obsidianBrainAideTemplate` changes: `brainPath` arg becomes optional. Absent → land `<BRAIN_PATH>` placeholder; present → land the path inline (preserves the existing CLI `--brain-path` cold-install path). Template gains two new sections (`config`, `update-playbook`) and renames three existing ones.
- `aide_init({ category: "brain" })` no longer requires `brainPath`. CLI `init --brain-path <path>` keeps working — it lands the path inline at scaffold time, so `/aide:brain config` short-circuits with "nothing to do" on first run.
- `provisionBrain` gains one new install step: seed `coding-playbook/update-playbook.md` from the new `updatePlaybook` typed key. Total install steps for `category: "brain"` go from 6 to 7 (brain.aide → root dirs → playbook-index → study-playbook → update-playbook → research-index → MCP entry).
- A `<BRAIN_PATH>` placeholder propagates verbatim into `.mcp.json` if the user runs sync before filling it in. That's fine — the brain server simply won't launch successfully until the path is filled. The config flow is what guarantees the placeholder is replaced before sync.

---

## Pipelined work (after sign-off)

1. **`brain.aide` schema** — rewrite the marker walker to the new 6-section grammar (`orientation`, `config`, `playbook-index`, `study-playbook`, `update-playbook`, `research-index`); rename typed-result keys (`prose → orientation`, `playbook → playbookIndex`, `research → researchIndex`) and add `config` + `updatePlaybook`; update parser tests; update `brain-aide.md` (section names, ownership table, fixed-order list, strict-failure migration paragraph).
2. **Default Obsidian template** — rename markers in `obsidianBrainAideTemplate` to the new names, add `<!-- aide-config-start -->` and `<!-- aide-update-playbook-start -->` sections with the prose above; update `orientation` to mention four entry-point files; make `brainPath` arg optional and land `<BRAIN_PATH>` placeholder when absent.
3. **`aide_brain` tool** — add `kind` param (`"orientation" | "config"`), default `"orientation"`, return the matching section verbatim, update tool tests. **No `update-playbook` kind** — that section is install-seed, not live.
4. **`aide_init` brain category** — `brainPath` optional in `provisionBrain` + types; add a 5th seed step for `coding-playbook/update-playbook.md` sourced from `updatePlaybook`; downstream consumers (playbook-index, study-playbook, update-playbook, research-index steps) read from the renamed typed keys; provisionBrain tests cover the placeholder path and the new step.
5. **`.claude/commands/aide/brain.md` Mode 2** — rewrite as the 5-step router above; the existing Mode 2 prose moves into the default Obsidian `config` section.
6. **`.claude/commands/aide/update-playbook.md`** — rewrite as the 1-paragraph pointer above (mirrors `study-playbook` skill); the existing checklist moves into the default Obsidian `update-playbook` brain.aide section.
7. **Host self-update** — this repo's own `.aide/config/brain.aide` migrates: rename all markers + paste `config` + `update-playbook` sections. Verify post-migration parse is `ok`. Re-run init to seed the new `coding-playbook/update-playbook.md` brain file.
8. **Smoke tests** —
   - Cold install: `/aide` → no-brain-aide branch → scaffold → `aide_brain({ kind: "config" })` → user supplies path → edit + sync → restart.
   - Update-playbook: `/aide:update-playbook` → `aide_brain` for read tool → read `coding-playbook/update-playbook.md` → execute its methodology → user describes change → edit → drift check → confirm.
