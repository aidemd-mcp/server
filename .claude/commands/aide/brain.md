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

When `$ARGUMENTS` starts with `config`, run this flow. It owns every brain config state: creating a missing `.aide/config/brain.aide`, repairing one that is missing required sections, validating the result, then wiring and seeding the brain. Writing a config, or missing sections, for a backend other than the bundled default is handed off to the `aide-brain-author` skill.

**This command never lists the brain config's sections itself.** The required sections are a published contract. Their markers, roles (`live` or `seed`) and seed paths come from `brainSummary.sections` on the `aide_init` step named `Brain config (brain.aide)`. A section's purpose comes from `aide_brain({ kind: <marker> })`, which returns it as `purpose` whenever it returns the section. Never write a section list or a purpose from memory.

**Every step below is mandatory and runs in order.** `brain.status` is a status code, not a runbook. If you find yourself drafting "next steps" for the user from your own understanding of a status code, you have skipped a step — go back.

**Reading the summary.** Call `aide_init` with **no arguments**. That is a read-only summary call; it writes nothing. Find the step named `Brain config (brain.aide)` and read its `brainSummary`: `sections`, `missingSections`, `staleSections`, `legacyLauncher` (reasons, or null) and `templateIntegration` (whether the config launches the bundled template's own brain server). It carries no section text. Section bytes reach you one section at a time, through `aide_brain` or an `aide_upgrade` preview.

**Writes go through `aide_upgrade`.** Inserting missing sections and applying a migration are tool-side writes: `aide_upgrade({ category: "brain" })` and its `brainChange` / `beforeHash` calls. Hand-edit `.aide/config/brain.aide` only to fix a malformed file. Writing for a backend other than the template's belongs to the `aide-brain-author` skill.

### Step 1 — Call `aide_info`

Call `aide_info`. Read `brain.status`, `brain.fault` (present only on `brain-aide-invalid`) and `brain.hints` (candidate brain-root paths the config prose may offer the user later). The status picks the branch:

- `no-brain-aide` — the file is missing → Step 2 (CREATE).
- `brain-aide-invalid` — the file is present but falls short → Step 3 (REPAIR).
- `ok`, `no-mcp-entry` or `mcp-drift` → skip to Step 5b (MIGRATE).

### Step 2 — CREATE (status `no-brain-aide`)

1. **Ask which backend.** Use `AskUserQuestion`: the bundled default (Obsidian) or another backend. **Another backend:** invoke the `aide-brain-author` skill (`Skill(skill="aide-brain-author")`). It asks the launch mode, writes the config section by section with the user, checks the draft and swaps it in. When it returns, go to Step 4.
2. **Ask the launch mode.** Use `AskUserQuestion` with these two options, exactly as worded:
   - **Global (recommended)** — personal machine, reliable startup; stays on its installed version; one-time `npm i -g`.
   - **Local** — shared repos, cloud/CI; pinned to one version that /aide:brain config moves forward; flaky cold start.

   The answer is `brainMode`: `"global"` or `"local"`.
3. **Scaffold.** Call `aide_init({ category: "brain", brainMode })`. It writes `.aide/config/brain.aide` from the latest bundled template, with YAML null at the unwired path slot of `mcpServerConfig.args`. YAML null is the structural unwired-slot signal; there is no literal-string placeholder.

Then go to Step 4.

### Step 3 — REPAIR (status `brain-aide-invalid`)

Branch on `brain.fault.kind`.

**`missing-sections`:**

1. Call `aide_init` with no arguments and read `brainSummary.missingSections` from the `Brain config (brain.aide)` step.
2. Show the user the markers of the missing sections, then confirm with `AskUserQuestion` (repair now / skip). On skip, STOP.
3. **Insert.** Call `aide_upgrade({ category: "brain" })`. It reads the file, inserts only the missing sections and touches nothing else. It returns one of:
   - **`{ outcome: "inserted", inserted }`** — the config launches the template's own brain server, so the missing sections went in byte-identical from the latest bundled template, in the file's line endings. `inserted` lists their markers. Done.
   - **`{ outcome: "adapt", adapt, instructions }`** — the config launches another backend, so nothing was inserted: the template text is Obsidian-specific (wiki links, the board plugin's frontmatter and settings, Obsidian brain tool names). Invoke the `aide-brain-author` skill (`Skill(skill="aide-brain-author", args="add missing sections: <the markers in adapt>")`). It writes each missing section with the user and inserts it in place. When it returns, go on.
   - **`{ outcome: "refused", instructions }`** — show `instructions` to the user and follow them.

Then go to Step 4.

**`malformed`:** show the user `brain.fault.reason` verbatim and help them fix that specific fault by hand — point at the offending lines and propose the minimal edit. Do not regenerate the file from the template; that would destroy their wiring and customizations. Once the user has fixed it, go to Step 4.

### Step 4 — VALIDATE

Call `aide_info` again. This is a parser check of the file on disk, not a brain query, so it is safe mid-session.

- `brain.status` is `no-brain-aide` or `brain-aide-invalid` → the config is still not valid. Show the status and `brain.fault`, return to Step 2 or Step 3, and do not continue.
- Any other status → continue to Step 5.

### Step 5 — SEED (sections added by a repair)

For each seed section you inserted in Step 3 (its `role` is `seed` in `brainSummary.sections`, which also gives its `seedPath`), write it to its `seedPath` in the brain:

- **Brain MCP tools loaded in this session:** presence-check `seedPath`; a missing folder means the file is absent. If it exists, skip it — never fetch or overwrite it. If absent, call `aide_brain({ kind: <marker> })`. With `found: true`, take `instructions` (that section's exact bytes), drop the empty lines at their start and end, and write them to `seedPath` with the brain's write tool. With `found: false`, show `instructions` to the user and do not write that seed. When those bytes open with a `---` frontmatter block, pass that block in whatever form the write tool expects for frontmatter (for example a separate frontmatter argument), and pass only the text after its closing `---` (leading empty lines dropped) as the body. Never leave a frontmatter block inside the body text, or the file will not get real frontmatter.
- **Brain MCP tools not loaded:** tell the user the new seed files will be written once they restart Claude Code and re-run `/aide:brain config`. Never fall back to native filesystem tools to write the brain.

After a CREATE, skip this step — Step 6's config prose seeds every seed section.

### Step 5b — MIGRATE (outdated sections and a legacy launcher)

Call `aide_init` with no arguments and read `brainSummary.staleSections` and `brainSummary.legacyLauncher` from the `Brain config (brain.aide)` step. If both are empty, go to Step 6. A file created in Step 2 never has either.

A section is listed as stale only when its text matches a known earlier template version, so a section the user edited is never offered. **Nothing changes without the user's explicit yes to that one change, and the default is skip.** The user's existing bytes cannot be recovered once replaced, so never batch changes under a single yes and never apply a change the user did not see.

Each change is one preview and one apply:

- **Preview:** `aide_upgrade({ category: "brain", brainChange: <target> })` is read-only and returns `{ outcome: "change", target, before, after, beforeHash }` — the current text and its replacement, in the file's line endings. It may return `{ outcome: "refused", instructions }` instead. Show `instructions` and move on; for example, the tool refuses to offer template text for a config that launches another backend.
- **Apply:** on the user's yes, call the same thing with the `beforeHash` the preview returned. It returns `{ outcome: "applied", target }`, or `refused` when the bytes changed since the preview. On that refusal, preview again and show the new diff before asking again.

1. **Outdated sections.** For each marker in `staleSections`, one at a time: preview it, call `aide_brain({ kind: <marker> })` for its `purpose`, show the marker, the purpose and the `before` and `after` text, and ask with `AskUserQuestion` (replace this section / keep mine). On keep, move on. On replace, apply it, then update its seed file:
   - **The file agents read is separate from the config.** A `seed` section (its `role` in `brainSummary.sections`, which also gives its `seedPath`) was written into the brain once, at its `seedPath`, and Step 5 and Step 6 never overwrite an existing seed. Replacing the section in the config leaves that file on the old text unless you update it here.
   - Read the file at `seedPath` with the brain's read tool. Call `aide_brain({ kind: <marker> })` for the section's new bytes (`instructions`, empty lines trimmed at both ends).
   - **File matches the old section** (the preview's `before`, compared ignoring line endings, surrounding whitespace and the file's frontmatter): it was never edited, so ask with `AskUserQuestion` (update the brain file / keep it), showing the file's path. On update, write the new bytes to `seedPath` with the brain's write tool, keeping the file's existing frontmatter.
   - **File differs** (the user edited it): show the file's current text beside the new section, say which rules changed, and ask (replace my file / keep mine), default keep. Replace only on an explicit yes.
   - Brain tools not loaded in this session: tell the user the brain file at `seedPath` still has the old text, and that re-running `/aide:brain config` after a restart offers it.
   - A `live` section has no seed file; replacing it in the config is the whole change.
2. **Legacy launcher.** When `legacyLauncher` lists reasons (`unpinned`, `unversioned`, `older-pin`, `missing-auto-confirm`), preview `brainChange: "launcher"`. The `after` keeps the launcher's current launch mode with a pinned version, and unchanged arg lines stay byte-identical. Show the reasons and the `before` and `after` frontmatter, and ask with `AskUserQuestion` (update the launcher / keep mine). On update, apply it. When the preview refuses because the args can't be safely rewritten in place, its `instructions` carry the replacement args. Help the user make that one edit by hand, changing nothing else in the frontmatter.
3. Call `aide_info` and confirm `brain.status` is not `no-brain-aide` or `brain-aide-invalid`. If it is, show the status and fault and help the user fix it; do not continue until it parses.

Then go to Step 6, which runs sync so `.mcp.json` picks up a changed launcher.

### Step 6 — WIRING/SEEDING

Get the backend's config prose, then execute it verbatim:

Call `aide_brain({ kind: "config" })`. On every status that reaches this step (`ok`, `no-mcp-entry`, `mcp-drift`) it returns `found: true` with that section of `.aide/config/brain.aide` verbatim in `instructions`. If it returns `found: false`, show its `instructions` to the user and STOP.

Forward `$ARGUMENTS` opaquely to that prose — this command does not parse it. The prose owns everything from here: what `$ARGUMENTS` means for this backend, asking the user for the brain location (`AskUserQuestion` plus `aide_info.brain.hints` when appropriate), landing the resolved value into the YAML-null slot, running sync via the Bash command recovered from `.mcp.json["mcpServers"]["aide"]`, seeding each seed section in the published contract (skip-on-exists), and emitting the restart message.

The prose also owns the brain launcher before sync runs: the brain's global-install check (and its install offer) for a global launcher, and moving a local launcher's pin forward. Do not check, install or re-pin the brain package yourself.

`no-mcp-entry` covers both unwired args (YAML null at the path slot) and unsynced args (a string at the path slot never written to `.mcp.json`). Only the prose's first step tells you which applies.

**Anti-patterns — each one means you have skipped or short-circuited the flow:**

- Telling the user to run sync themselves. Sync runs via your own Bash tool, recovered from `.mcp.json["mcpServers"]["aide"]` (`command` + `args` + `"sync"` appended). The user invoked `/aide:brain config` expecting it to complete the wiring, not to hand them homework.
- Concluding `brain.aide` is wired or unwired without quoting the actual bytes at the path slot. The prose's first step reads and quotes that value — you cannot quote what you did not read.
- Treating `brain.status` as a runbook, or treating an `aide_brain` reply with `found: false` as if it were the requested section.
- Listing, restating or inventing the brain config's sections or their purposes instead of reading `brainSummary.sections` and `aide_brain`'s `purpose`.
- Hand-inserting missing sections or hand-applying a migration that `aide_upgrade` can do, or rewriting, reordering or reformatting existing sections during a repair.
- Applying a change without the user's yes to that specific preview, reusing a `beforeHash` after a refusal, or changing a section or launcher the summary did not list.
- Comparing the config prose against guidance outside it. The prose is the authority — follow it as written.
- Falling back to native filesystem tools (`Read`, `Write`, `Glob`, Bash `ls`, etc.) to inspect or write the **brain** when the brain MCP tools are unreachable. The brain is backend-agnostic; if its tools are unreachable, STOP and tell the user to restart. (Editing `.aide/config/brain.aide` is fine — it is a project file, not the brain.)

### Step 7 — STOP

After Step 6 completes, **STOP**. Do NOT call `aide_info` again in this session. The brain MCP server was launched before the new entry existed and cannot be hot-reloaded mid-session — an in-session re-check after sync would report stale truth. Continuation happens on the next `/aide` invocation after the user restarts Claude Code.

### Failure handling (`aide_init` scaffold)

If the `aide_init({ category: "brain" })` call in Step 2 throws or the scaffold fails, do NOT retry inline, do NOT re-prompt the user. Surface the error and fall back to the CLI:

> Something went wrong scaffolding `.aide/config/brain.aide`: `<error message>`.
>
> Run `aidemd-mcp init` when the project's `aide` MCP entry runs the globally installed `aidemd-mcp`, or `npx -y @aidemd-mcp/server@<version> init` with the version that entry pins when it runs through npx, in this project's terminal to retry the setup with full per-file logging, then restart Claude Code and re-run `/aide`.

Sync and brain-seeding failures inside Step 6 are owned by the config prose and its own error recovery.

---

## Arguments

`$ARGUMENTS` is forwarded verbatim to the integration's config prose (Mode 2, Step 6). The shipped command does not parse, validate, or interpret it. Each integration's `brain.aide` `config` section documents what users can put after `/aide:brain config` for that backend. Anything other than `config` (or empty) routes to Mode 1.
