---
name: aide-brain-author
description: >
  Author a brain config (`.aide/config/brain.aide`) for any brain
  backend, such as Jira, Notion, Confluence or a team wiki, one decision
  at a time with the user. It starts from the bundled template as a
  worked example, writes the launcher and every contract section for the
  user's backend from each section's published purpose, checks the
  draft's structure, then either swaps it in or leaves it beside the
  current config. It also adds missing contract sections to a config
  written for another backend. Invoke it when the user asks to create a
  brain config for a backend other than the bundled default, to rewrite
  their brain config for a different backend, or when `/aide:brain
  config` hands off a create or a custom-backend repair. Do NOT trigger for wiring, syncing,
  migrating or repairing a config that uses the bundled default backend;
  that stays with `/aide:brain config`.
---

# aide-brain-author — Write a Brain Config for Any Backend

The brain config tells every AIDE agent how to reach the project's brain: the launcher that starts the brain's MCP server, and a fixed set of contract sections, each with a published purpose. The bundled template fills them for its own default backend. This skill writes them for the user's backend instead.

Every section list, role, purpose and template text comes from `aide_brain`. Never write a section list or a purpose from memory, and never copy one from another config.

## Hard constraints

- **Structure is checked; content is the user's.** The draft check confirms every required field and section is present and well-formed. Whether the prose works for the backend is the user's call. Confirm each section with the user before moving on.
- **One section at a time.** Read one section, write it with the user, confirm, then read the next. Never fetch the whole template up front.
- **Draft first when writing a whole config.** Write the new config to `.aide/config/brain.aide.draft`. The live config at `.aide/config/brain.aide` changes only at the swap step, and only on the user's yes. The one exception is adding missing sections (below), which edits the live config in place because the user already chose to repair it.
- **Never invent backend tool names.** Ask the user how their backend's MCP server is launched and which tools it exposes, or read its documentation with them. If they don't know yet, leave a clearly marked TODO in that section and tell them.

## The tool calls

`aide_brain` is read-only in every mode below. None of them reads or depends on the project's current brain config.

- `aide_brain({ source: "contract" })` returns `{ sections }`: every contract section in order, each with its `marker`, `role` (`live` or `seed`) and `purpose`, and no text.
- `aide_brain({ source: "template", kind: "launcher" })` returns `{ template, purpose }`: the bundled template's frontmatter lines (between the two `---` fences) and what the launcher must do.
- `aide_brain({ source: "template", kind: <marker> })` returns `{ template, purpose }`: the bundled template's text for that one section and what the section must do.
- `aide_brain({ source: "draft", path: ".aide/config/brain.aide.draft" })` returns `{ outcome, instructions }`. `outcome` is `valid`, `invalid` (with a `fault`: `missing-sections` naming the sections, or `malformed` with a `reason`), `absent`, or `refused` (the path is outside the project). It uses the same rules and fault wording as the live config check, so a `valid` draft is structurally ready to swap in.

## Steps

### 1. Ask about the backend

Use `AskUserQuestion`:

Which backend holds the brain, and how its MCP server is launched (package or command, and the argument that points it at the brain's location).

### 2. Check for an existing config

Call `aide_info` and read `brain.status`.

- `no-brain-aide`: there is no config. The draft becomes the config at the end.
- Any other status: a config exists. Ask with `AskUserQuestion`:
  - **Replace it.** Write the draft, then swap it in at step 7. The current file is kept as `.aide/config/brain.aide.bak`.
  - **Write it beside.** Write the draft and stop at step 7, leaving `.aide/config/brain.aide.draft` for the user to swap in later.

If `.aide/config/brain.aide.draft` already exists, ask whether to overwrite it or stop.

### 3. Read the contract

Call `aide_brain({ source: "contract" })`. Its `sections` are the work list, in order. Show the user how many sections there are and which are `live` and which are `seed`:

- **Live** sections are read at runtime by agents and by `/aide:brain config`: how to reach the brain, and how to wire it.
- **Seed** sections are written into the brain once, at their seed paths, the first time it is wired: the playbook, research and kanban guides the agents rely on.

### 4. Write the launcher

Call `aide_brain({ source: "template", kind: "launcher" })`. Show the user the `purpose` and the template's frontmatter, then write the draft's frontmatter for their backend:

- `name`: a short descriptive label for the brain.
- `mcpServerConfig`: `command` and `args` that start the backend's MCP server. Leave YAML `null` at the one `args` slot the brain's location fills; `/aide:brain config` fills it during wiring.
  - The command is the backend's bare command name from a global install, never an absolute path and never a package runner such as npx, whose launches time out at session start. Run the backend's global-install check (for an npm package, `npm ls -g <package> --depth=0`). If it is missing, run the install (for an npm package, `npm i -g <package>`).
  - **On a failed install,** tell the user plainly and stop before writing the draft: a launcher whose command is not installed cannot start.
- Add no other frontmatter field. The parser rejects extra fields.

Write the draft file with the frontmatter between its two `---` fences.

### 5. Write each section

For each section from step 3, in order:

1. Call `aide_brain({ source: "template", kind: <marker> })`.
2. Show the user the marker, the `purpose` and the template text. The template is a worked example for the bundled backend: its tool names, link syntax, file formats and board layout belong to that backend and do not carry over.
3. Write the section with the user so it fulfills its `purpose` on their backend: their tool names, entry points, link syntax, frontmatter and task format. For a **seed** section, also keep the structure the template's prose gives agents (the steps, the rules, what to read first), translated to the backend.
4. Confirm with the user, then append it to the draft between its two marker lines, `<!-- aide-<marker>-start -->` and `<!-- aide-<marker>-end -->` with the section's real marker name. Leave one blank line between sections.

### 6. Check the draft

Call `aide_brain({ source: "draft", path: ".aide/config/brain.aide.draft" })`.

- `valid`: go to step 7.
- `invalid`: show the `fault` and `instructions`, fix exactly what it names with the user, and check again.
- `absent` or `refused`: show `instructions` and fix the path.

### 7. Swap in or leave beside

- **No config existed:** rename `.aide/config/brain.aide.draft` to `.aide/config/brain.aide`.
- **Replace:** on the user's yes, rename the current `.aide/config/brain.aide` to `.aide/config/brain.aide.bak`, then rename the draft into its place.
- **Beside:** stop. Tell the user where the draft is, and that swapping it in means renaming it to `.aide/config/brain.aide` and then running `/aide:brain config`.

After a swap, call `aide_info` and confirm `brain.status` is no longer `no-brain-aide` or `brain-aide-invalid`. If `/aide:brain config` handed off here, return to it; it continues with validation and wiring. Otherwise tell the user to run `/aide:brain config`: it wires the brain location into the launcher, syncs `.mcp.json` and writes the seed sections into the brain.

## Adding missing sections to an existing config

`/aide:brain config` hands off here when a config written for another backend is missing contract sections (the upgrade tool answered `adapt` with the missing markers). This mode only adds those sections. It edits the live `.aide/config/brain.aide` in place, because the user already chose to repair it, and changes no other byte.

For each missing marker, one at a time:

1. Call `aide_brain({ source: "template", kind: <marker> })` and write the section with the user, as in step 5. Use the existing sections of their config as the guide to their backend's tool names and conventions.
2. Insert it with its two marker lines right after the end marker of the section that comes before it in contract order (from `aide_brain({ source: "contract" })`). Leave one blank line between sections and keep the file's line endings.

Then call `aide_info` and confirm `brain.status` is not `brain-aide-invalid`, and return to `/aide:brain config`.

## Anti-patterns

- Listing, restating or inventing the contract's sections or purposes instead of reading them from `aide_brain`.
- When writing a whole config, editing `.aide/config/brain.aide` before the draft checks `valid` and the user says yes.
- Copying the template's tool names, link syntax or board format into a section for another backend.
- Writing several sections before the user confirms the first.
- Running sync or seeding the brain yourself. `/aide:brain config` owns wiring and seeding.
