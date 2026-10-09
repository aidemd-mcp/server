import { platform } from "node:os";
import kanbanIndexSeed from "./kanbanSeeds/hub/index.js";
import kanbanCreateSeed from "./kanbanSeeds/guide/create/index.js";
import kanbanWorkSeed from "./kanbanSeeds/guide/work/index.js";
import kanbanManageSeed from "./kanbanSeeds/guide/manage/index.js";
import kanbanMoveSeed from "./kanbanSeeds/guide/move/index.js";
import kanbanCompleteSeed from "./kanbanSeeds/guide/complete/index.js";
import kanbanStashSeed from "./kanbanSeeds/guide/stash/index.js";
import kanbanReviewSeed from "./kanbanSeeds/guide/review/index.js";
import type { LaunchMode } from "@/types/index.js";

/**
 * The pinned brain package (`@bitbonsai/mcpvault`) version the local launcher and
 * the config prose both name. Bumped by hand after a new release is verified
 * (brief #19); a test asserts the prose and the launcher agree.
 */
const MCPVAULT_VERSION = "0.16.0";

/**
 * Returns the complete canonical bundled `brain.aide` file content as a string,
 * ready to write to disk at `.aide/config/brain.aide` in the host project root.
 *
 * Takes an optional launch `mode` (default `"local"`). The path slot in `mcpServerConfig.args` is always YAML null
 * in the emitted output — the structural unwired-slot signal carried by the typed
 * `(string | null)[]` schema. The agent fills the null slot with the user's real
 * path via `/aide:brain config`, then runs sync; sync writes the wired entry to
 * `.mcp.json` and refuses to write null-bearing args. The integration's
 * `<!-- aide-config-start -->` body section carries the full wiring flow prose,
 * including the post-sync seeding step, which reads the published section
 * contract instead of restating a list of artifacts.
 *
 * The returned string has fourteen body sections. The authoritative list, order and
 * per-section roles are owned by `@/service/brainContract`; the parser enforces
 * it and this template must carry a block for every entry. By role:
 *
 * - **Live sections** are read at runtime from the brain config and never written
 *   into the brain. `orientation` is the agent-facing briefing `aide_brain` returns
 *   (tools to reach the brain, entry points to start from, and a pointer to the
 *   per-project card folders and the kanban index that links its guides). `config` is the Obsidian wiring and seeding flow
 *   `/aide:brain config` runs. Both are user-editable post-scaffold.
 *
 * - **Seed sections** are install-time bytes written into the user's brain at
 *   their contract `seedPath`, once, when absent. All are user-editable
 *   post-scaffold:
 *   - the coding-playbook index, the study-playbook navigation methodology, the
 *     update-playbook maintenance methodology (backend-agnostic: no MCP tool
 *     names) and the research index;
 *   - `kanban-index` and the seven operation guides (`kanban-create`,
 *     `kanban-work`, `kanban-manage`, `kanban-move`, `kanban-complete`,
 *     `kanban-stash`, `kanban-review`): an exact, lossless split of the user's
 *     working kanban guide into a short index (card folders, cards, project, cleanup rules, how to
 *     reach the cards) and one guide per operation. They are Obsidian-specific by
 *     design (wiki links, the `Related:` line, the
 *     `mcp__brain__*` tool table) and carry frontmatter. Their text lives in
 *     `kanbanSeeds/hub` and `kanbanSeeds/guide/<operation>`; the marker lines stay
 *     here, and each section parses to `"\n\n" + seed + "\n"`.
 *
 * Load-bearing constraints:
 * - Frontmatter is exactly `name` + `mcpServerConfig` — minimum schema is the
 *   maximum schema. The parser rejects any additional top-level field as
 *   `malformed-frontmatter`.
 * - The path slot in `mcpServerConfig.args` is a bare-dash YAML null line in
 *   every emission. POSIX: `args` parses to `["-y", "@bitbonsai/mcpvault@0.16.0", null]`.
 *   Win32: `args` parses to `["/c", "npx", "-y", "@bitbonsai/mcpvault@0.16.0", null]`. No
 *   quoted empty string, no literal-string sentinel, no `${...}` interpolation
 *   at the unwired slot. The user fills the slot via `/aide:brain config`.
 * - Platform branching: Windows uses `command: cmd` with `["/c", "npx", ...]`
 *   args to work around Windows shell constraints. POSIX uses `command: npx`
 *   directly. The platform check is isolated here and nowhere else in this module.
 *   The `mode` argument selects a global launcher (the bare `mcpvault` command) or
 *   the local npx launcher pinned with `-y` to `MCPVAULT_VERSION`; the default is local.
 * - Heading levels: the playbook-index and study-playbook sections use `## ` for
 *   top-level sub-sections under their `# ` title, since these sections are seeded
 *   into standalone files where `## ` is the natural sub-heading level. The
 *   update-playbook section uses `## ` sub-sections under `# Update Playbook`.
 *   The research-index section keeps `### ` only (its top-level structure is shallow).
 *   The kanban index and each operation guide use `## ` under their `# ` title
 *   (the board's `## ` lines are its column headings). The orientation and config
 *   sections have no headings.
 * - Retired marker names (`aide-prose-*`, `aide-playbook-*` without `-index`,
 *   `aide-research-*` without `-index`) are gone. The parser treats them as plain
 *   bytes and returns `malformed-body` (missing markers) for any brain.aide that
 *   still uses the old four-section grammar.
 */
export default function obsidianBrainAideTemplate(mode: LaunchMode = "local"): string {
	const mcpServerConfig =
		mode === "global"
			? `mcpServerConfig:\n  command: mcpvault\n  args:\n    -`
			: platform() === "win32"
				? `mcpServerConfig:\n  command: cmd\n  args:\n    - '/c'\n    - 'npx'\n    - '-y'\n    - '@bitbonsai/mcpvault@${MCPVAULT_VERSION}'\n    -`
				: `mcpServerConfig:\n  command: npx\n  args:\n    - '-y'\n    - '@bitbonsai/mcpvault@${MCPVAULT_VERSION}'\n    -`;

	return (
		`---\n` +
		`name: obsidian\n` +
		`${mcpServerConfig}\n` +
		`---\n` +
		`\n` +
		`<!-- aide-orientation-start -->\n` +
		`\n` +
		`Your brain is an Obsidian-backed knowledge store. Use \`mcp__brain__read_note\` to\n` +
		`open files by their brain-relative path. Use \`mcp__brain__search_notes\` for\n` +
		`keyword queries across every note in the store. The store's entry-point\n` +
		`artifacts include the coding-playbook index at \`coding-playbook/coding-playbook.md\`, the\n` +
		`study-playbook navigation guide at \`coding-playbook/study-playbook.md\`, the\n` +
		`update-playbook maintenance guide at \`coding-playbook/update-playbook.md\`, and the\n` +
		`research index at \`research/research.md\`. Start from the relevant entry-point for\n` +
		`your task, follow the references it lists to deepen context, and check those\n` +
		`files' references too. Stay in scope; don't follow references into unrelated topics.\n` +
		`\n` +
		`Project work is tracked as kanban cards in per-project folders under \`kanban/<project>/\`, one subfolder per column. Before any card operation, read the kanban index at \`kanban/kanban.md\`, then read only the guide it links for the operation you are performing.\n` +
		`\n` +
		`<!-- aide-orientation-end -->\n` +
		`\n` +
		`<!-- aide-config-start -->\n` +
		`\n` +
		`You are completing the wiring of an Obsidian brain. The required value is the\n` +
		`absolute path to the user's Obsidian vault, to be placed at the last entry of\n` +
		`\`mcpServerConfig.args\` in \`brain.aide\`. YAML null at that position is the\n` +
		`unwired-state signal — it means the brain path has not yet been filled in.\n` +
		`\n` +
		`Argument shape (Obsidian only): \`/aide:brain config [<absolute-path>]\`.\n` +
		`\n` +
		`This flow has two paths that NEVER overlap in the same session: WIRING and\n` +
		`SEEDING. Wiring edits \`brain.aide\` and runs sync, then STOPS — the brain MCP\n` +
		`server only loads at session start, so any newly-wired brain entry is\n` +
		`unreachable until the user restarts Claude Code. Seeding writes the\n` +
		`entry-point artifacts via the brain MCP tools, which only works when the brain\n` +
		`is already wired AND the session has the brain MCP server loaded — i.e., on a\n` +
		`run AFTER the wiring restart.\n` +
		`\n` +
		`1. **Read \`brain.aide\` now and quote the last entry of \`mcpServerConfig.args\`.**\n` +
		`   Open \`brain.aide\` and locate the final entry in the \`mcpServerConfig.args\`\n` +
		`   list. Quote the literal value you observe — either YAML null (an empty entry,\n` +
		`   written as a bare dash with no value) or a string. **Do not proceed without\n` +
		`   quoting it.** YAML null means un-wired; any string value means already wired.\n` +
		`\n` +
		`2. Decide which flow runs:\n` +
		`   - \`$ARGUMENTS\` non-empty → **WIRING** flow. Use \`$ARGUMENTS\` as the target\n` +
		`     path (initial wiring or re-point). Proceed to Step 3.\n` +
		`   - \`$ARGUMENTS\` empty AND last entry is YAML null → **WIRING** flow. Ask the\n` +
		`     user where their vault lives via \`AskUserQuestion\` with \`aide_info.brain.hints\`\n` +
		`     as suggestions plus a "Different location" entry. Use the answer as the\n` +
		`     target path. Proceed to Step 3.\n` +
		`   - \`$ARGUMENTS\` empty AND last entry is a string path → **SEEDING** flow.\n` +
		`     The brain is already wired; skip Steps 3 and 4 entirely and jump to Step 5.\n` +
		`     Before seeding, if the launcher is local (\`npx\`, directly or after \`cmd /c\`) and its \`@bitbonsai/mcpvault\` spec has no version, is \`@latest\`, or pins a version older than \`${MCPVAULT_VERSION}\`, offer with \`AskUserQuestion\` to update it to \`-y @bitbonsai/mcpvault@${MCPVAULT_VERSION}\`. On yes, edit only that spec (adding \`-y\` if missing), run Step 4 (sync) and stop as the WIRING flow does. On no, continue to seeding unchanged. Never change an equal or newer pin, and never change the launch mode here.\n` +
		`\n` +
		`### WIRING flow — Steps 3, 4 (then STOP at end of 4)\n` +
		`\n` +
		`3. Edit \`brain.aide\` — replace the null at the last entry of \`mcpServerConfig.args\`\n` +
		`   with the absolute path.\n` +
		`\n` +
		`   Then check how this config launches the brain. If the launched program is \`mcpvault\` (the file name of \`mcpServerConfig.command\`, or of the entry after \`/c\` when the command is \`cmd\`, with or without a directory path or a \`.cmd\` / \`.exe\` extension), the brain launches from a global install. In that case, run \`npm ls -g @bitbonsai/mcpvault --depth=0\` via Bash. If the package is not listed, ask with \`AskUserQuestion\`: "Install now (\`npm i -g @bitbonsai/mcpvault\`)" or "Use local launch instead". Run the install via Bash only after the user picks install. If the user picks local, or the install exits non-zero, rewrite \`mcpServerConfig\` to the pinned local launcher and keep the path you just wrote as the last entry: \`command: npx\` with args \`-y\`, \`@bitbonsai/mcpvault@${MCPVAULT_VERSION}\`, \`<path>\`; on Windows, \`command: cmd\` with args \`/c\`, \`npx\`, \`-y\`, \`@bitbonsai/mcpvault@${MCPVAULT_VERSION}\`, \`<path>\`. Then tell the user the brain will launch locally through npx, pinned to that version. If the launcher is already local, apply the same pin check as step 2: offer to move an unpinned, \`@latest\` or older pin to \`@bitbonsai/mcpvault@${MCPVAULT_VERSION}\`, and apply it only on the user's OK. A global launcher given by absolute path is valid; never rewrite it for being a path. Never switch a launcher between global and local for any other reason.\n` +
		`\n` +
		`4. **Run sync now via Bash.** Read \`.mcp.json["mcpServers"]["aide"]\`, take its\n` +
		`   \`command\` and \`args\`, append the literal string \`"sync"\`, and execute the\n` +
		`   resulting command via the Bash tool. Quote the exit code. On non-zero, surface\n` +
		`   stderr and stop. On exit 0:\n` +
		`\n` +
		`   **STOP HERE in the WIRING flow.** Do not proceed to Step 5 in the same\n` +
		`   session. The brain MCP server was not loaded at session start (it did not\n` +
		`   exist yet), and sync just wrote the entry; the running session cannot see\n` +
		`   it. Emit this message verbatim and end the flow:\n` +
		`\n` +
		`   > Sync wrote the brain entry. Restart Claude Code so the brain MCP server\n` +
		`   > picks up the new entry, then re-run \`/aide:brain config\` to seed the\n` +
		`   > entry-point artifacts into your brain.\n` +
		`\n` +
		`   **Do not output the sync command for the user to run** — \`/aide:brain config\`\n` +
		`   completes wiring inside the slash-command session, never by handing the user\n` +
		`   a homework command.\n` +
		`\n` +
		`### SEEDING flow — Step 5\n` +
		`\n` +
		`5. **Seed the entry-point artifacts into the brain via the brain MCP tools.**\n` +
		`\n` +
		`   First verify the brain MCP write/list tools are available in this session\n` +
		`   (\`mcp__brain__write_note\`, \`mcp__brain__list_directory\`, etc.). If they are\n` +
		`   NOT available, the brain MCP server has not been loaded in this session. Emit\n` +
		`   this message verbatim and STOP:\n` +
		`\n` +
		`   > The brain MCP server is not loaded in this session. Restart Claude Code,\n` +
		`   > then re-run \`/aide:brain config\` to seed the entry-point artifacts.\n` +
		`\n` +
		`   **Never fall back to native filesystem tools** (Read, Write, Bash \`ls\`,\n` +
		`   Glob, etc.) to inspect or write the brain. The brain is a backend-agnostic\n` +
		`   abstraction; the filesystem is just one possible backing store. Other backends\n` +
		`   (hosted, Mem0, etc.) have no local filesystem at all. If the brain MCP tools\n` +
		`   are unreachable, the correct response is to STOP and ask the user to restart,\n` +
		`   never to improvise via the filesystem.\n` +
		`\n` +
		`   When the brain MCP tools ARE available, read the published section contract: call \`aide_init\` with no arguments (a read-only summary call) and take \`brainContract\` from the step named \`Brain config (brain.aide)\`. For each entry whose \`role\` is \`seed\`: presence-check its \`seedPath\` via \`mcp__brain__list_directory\` (or the read tool); if absent, take the bytes between that section's markers in brain.aide, drop the empty lines at their start and end, and write them with \`mcp__brain__write_note\` at \`seedPath\`. When those bytes open with a \`---\` frontmatter block, pass that block's fields as the tool's \`frontmatter\` argument and only the text after its closing \`---\` (leading empty lines dropped) as \`content\`; never leave a frontmatter block inside \`content\`, or the file will not have real frontmatter. A missing folder on the presence check means the file is absent. Skip any artifact that already exists (presence-only check — do not overwrite user-edited content).\n` +
		`\n` +
		`   After the seeding loop completes, emit a brief completion summary naming\n` +
		`   each artifact and whether it was seeded or already present. Do not emit a\n` +
		`   restart message — the brain is fully wired and seeded; the user can now use\n` +
		`   \`/aide\` normally.\n` +
		`\n` +
		`<!-- aide-config-end -->\n` +
		`\n` +
		`<!-- aide-playbook-index-start -->\n` +
		`\n` +
		`# Coding Playbook\n` +
		`\n` +
		`Reference for the conventions and patterns this codebase follows. Read top-down — load only the sections that apply to the current task.\n` +
		`\n` +
		`## Task Routing\n` +
		`\n` +
		`When loading playbook context, match the task domain to the relevant section(s). Read only what applies — do NOT load all sections.\n` +
		`\n` +
		`| Task domain | Section |\n` +
		`|-------------|---------|\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## How to Use This Index\n` +
		`\n` +
		`Each section links to a section hub that lists its notes with keywords. Navigate to the section relevant to your task, then drill into the specific notes you need.\n` +
		`\n` +
		`### Always Read First\n` +
		`\n` +
		`These notes are **required reading** for every task, regardless of which section you're working in. They define the patterns everything else builds on:\n` +
		`\n` +
		`1. **[[your-conventions-note]]** — Add your naming, function ordering, and code hygiene conventions here.\n` +
		`2. **[[your-folder-structure-note]]** — Add your folder layout and progressive disclosure conventions here.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Sections\n` +
		`\n` +
		`Add your top-level playbook sections here, each linked to its section hub note.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Prime Examples\n` +
		`\n` +
		`Add links to reference codebases that demonstrate these patterns in practice.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Contents\n` +
		`\n` +
		`<!-- aide-playbook-index-end -->\n` +
		`\n` +
		`<!-- aide-study-playbook-start -->\n` +
		`\n` +
		`# Study Playbook\n` +
		`\n` +
		`Navigate the coding playbook hub and load only the sections relevant to the current task.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Step 1: Read the Playbook Hub\n` +
		`\n` +
		`Read \`coding-playbook/coding-playbook.md\`.\n` +
		`\n` +
		`The hub lists sections with descriptions. Match your current task domain against\n` +
		`those descriptions to identify which sections apply. Do NOT read all sections —\n` +
		`only the ones whose descriptions overlap with the work at hand.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Step 2: Read the Relevant Section Hubs\n` +
		`\n` +
		`For each matching section, read its hub note (e.g. \`<section>/<section>.md\`).\n` +
		`\n` +
		`Section hubs list their child notes with keywords. Scan the list and identify which\n` +
		`specific child notes overlap with the task. Do NOT read every child — only the ones\n` +
		`whose keywords match the work.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Step 3: Read the Specific Child Notes\n` +
		`\n` +
		`Read the child notes identified in Step 2 (e.g. \`<section>/<child-note>.md\`).\n` +
		`These contain the concrete patterns and code examples to follow.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Navigation Rules\n` +
		`\n` +
		`- **Use the hub's link structure, not search.** Do NOT search for playbook content.\n` +
		`  Searching produces fragments without context; the hub structure gives you the full\n` +
		`  picture.\n` +
		`- **Read top-down.** Hub → section hub → child note. Never skip levels.\n` +
		`- **Follow wikilinks 1–2 levels deep from content notes.** Hub notes (tagged \`hub\` or\n` +
		`  acting as section indexes) are navigation — they don't count as depth. Depth starts\n` +
		`  at the first content note you land on. Example:\n` +
		`  - \`coding-playbook.md\` (root hub) → depth 0 (navigation)\n` +
		`  - \`foundations/foundations.md\` (section hub) → depth 0 (navigation)\n` +
		`  - \`foundations/conventions.md\` (content note) → depth 0 (first real content)\n` +
		`  - wikilink from \`conventions.md\` → depth 1\n` +
		`  - wikilink from *that* note → depth 2\n` +
		`\n` +
		`  When reading any content note, look for \`[[wikilinks]]\`. If a linked note looks\n` +
		`  relevant to the task, read it — then check *that* note's links too. Go at least\n` +
		`  1–2 levels deep from the first content note in any direction where the information\n` +
		`  could apply. Playbook notes cross-reference each other (e.g. a services note may\n` +
		`  link to error-handling patterns, which links to API response conventions). Following\n` +
		`  these links is how you build the full picture, not just a fragment.\n` +
		`- **Never re-read notes.** Before reading any note, check whether it already appears\n` +
		`  in your conversation context from earlier in the session. You may return to the\n` +
		`  playbook multiple times across a single workflow — do NOT re-read the playbook hub,\n` +
		`  section hubs, or child notes you have already loaded. The same applies when following\n` +
		`  wikilinks: skip any link whose target you have already read in this session.\n` +
		`- **Approach incrementally, not all at once.** Multi-step work (e.g. planning an\n` +
		`  end-to-end feature) crosses multiple domains — types, then services, then API, then\n` +
		`  client. Do NOT try to load every section upfront. Load what you need for the current\n` +
		`  step. When you move to the next step and realize you're in a new domain without the\n` +
		`  relevant playbook context, return to the playbook hub for that domain. The "never\n` +
		`  re-read" rule keeps repeated visits cheap — you'll skip the hub and any notes already\n` +
		`  loaded, and only read the new sections you actually need.\n` +
		`- **Stop when you have enough.** Within a single invocation, if the step only touches\n` +
		`  one domain (e.g. just API routes), you only need that one section's notes plus\n` +
		`  whatever they link to. Don't load unrelated sections "just in case."\n` +
		`\n` +
		`<!-- aide-study-playbook-end -->\n` +
		`\n` +
		`<!-- aide-update-playbook-start -->\n` +
		`\n` +
		`# Update Playbook\n` +
		`\n` +
		`Maintenance methodology for the coding playbook. The three-layer structure\n` +
		`(root hub → section hubs → child notes) and how to navigate it is described in\n` +
		`\`coding-playbook/study-playbook.md\`; this note covers the operations that\n` +
		`preserve it when adding, modifying, renaming, or removing entries.\n` +
		`\n` +
		`## What Belongs Here\n` +
		`\n` +
		`The playbook holds reusable engineering conventions and patterns — naming\n` +
		`rules, error-handling shapes, fetch patterns, schema conventions, anti-patterns,\n` +
		`testing patterns, etc. It does NOT hold project-specific context (environment,\n` +
		`business rules, in-progress feature notes), domain research, retro findings, or\n` +
		`operational runbooks. Those live in other parts of the brain. If the entry\n` +
		`isn't a rule that survives across projects, it doesn't belong here.\n` +
		`\n` +
		`## Layout\n` +
		`\n` +
		`The playbook lives under \`coding-playbook/\` with this shape:\n` +
		`\n` +
		"```\n" +
		`coding-playbook/\n` +
		`├── coding-playbook.md          ← root hub\n` +
		`├── study-playbook.md           ← navigation methodology\n` +
		`├── update-playbook.md          ← this note\n` +
		`├── prime-examples.md           ← (optional) reference codebases\n` +
		`├── foundations/\n` +
		`│   ├── foundations.md          ← section hub (navigation only)\n` +
		`│   ├── conventions.md          ← child note (rules + code)\n` +
		`│   ├── tooling.md\n` +
		`│   └── anti-patterns.md\n` +
		`├── architecture/\n` +
		`│   ├── architecture.md         ← section hub\n` +
		`│   ├── folder-structure.md\n` +
		`│   ├── data-flow.md\n` +
		`│   └── patterns.md\n` +
		`└── ... (one folder per section)\n` +
		"```\n" +
		`\n` +
		`Paths an updater needs to recognize:\n` +
		`\n` +
		`- Root hub: \`coding-playbook/coding-playbook.md\`\n` +
		`- Section hub: \`coding-playbook/<section>/<section>.md\`\n` +
		`- Child note: \`coding-playbook/<section>/<note>.md\`\n` +
		`\n` +
		`Section hubs (\`<section>/<section>.md\`) hold **no patterns themselves** — only\n` +
		`their \`## Subnotes\` table, \`## When to Read This Section\` list, and the\n` +
		`\`Part of [[coding-playbook/coding-playbook|Coding Playbook]]\` backreference.\n` +
		`Every pattern, rule, and code example lives in child notes.\n` +
		`\n` +
		`Hub notes (root and section) carry frontmatter tags\n` +
		`\`["coding-playbook","hub","context"]\`. Child notes have no required frontmatter\n` +
		`convention.\n` +
		`\n` +
		`## Note Scope (Progressive Disclosure)\n` +
		`\n` +
		`Each child note should be tightly scoped to a single topic an agent might need\n` +
		`to look up — naming, error handling, a specific fetch pattern, etc. Notes are\n` +
		`short and focused, not long catch-alls. Connect related notes with \`[[wikilinks]]\`\n` +
		`so an agent reading one can follow the trail rather than load everything upfront.\n` +
		`\n` +
		`If a note has drifted into multiple topics, or grown past the point where an\n` +
		`agent can scan it quickly, split it: extract each topic into its own child\n` +
		`note, add rows to the section hub's \`## Subnotes\` table for the new notes,\n` +
		`update the root hub's \`## Contents\` list, and replace the moved content in the\n` +
		`original note with a wikilink to the new note. An agent should not have to\n` +
		`parse 500 lines of markdown to learn how to name a variable.\n` +
		`\n` +
		`## Entry Format\n` +
		`\n` +
		`Each rule inside a child note follows a consistent shape so an agent can scan\n` +
		`quickly and learn from concrete examples.\n` +
		`\n` +
		`1. **Lead with the rule.** A bolded one-sentence principle as the first line of\n` +
		`   the section or bullet — e.g. **Name variables after the function that\n` +
		`   produces them.** State the rule plainly; the rest of the entry justifies and\n` +
		`   illustrates it.\n` +
		`\n` +
		`2. **State the reason inline.** One or two sentences explaining *why*. The\n` +
		`   reason is what an agent uses to judge edge cases the rule didn't anticipate.\n` +
		`   Don't split rule and reason across distant sections — they read as a unit.\n` +
		`\n` +
		`3. **Show real code.** Use code blocks in the project's actual language (not\n` +
		`   pseudocode). When the example is lifted from a specific file, prefix the\n` +
		`   block with a provenance HTML comment naming the project and path, e.g.\n` +
		`   \`<!-- from <project-name>: src/path/to/file.ts -->\`, so the source stays\n` +
		`   traceable as the codebase evolves. Only fill in real project names and\n` +
		`   paths — never leave the angle-bracket placeholders in a published note.\n` +
		`\n` +
		`4. **Pair Good and Bad examples.** Most rules have a clear right and wrong\n` +
		`   shape — show both. Tag each block with a one-line reason in a code comment:\n` +
		`   \`// Good — descriptive noun, no redundant suffix\` and\n` +
		`   \`// Bad — Result suffix adds nothing\`. When a rule has multiple failure\n` +
		`   modes (e.g. helpers inline above the export vs. helpers buried below it),\n` +
		`   show one Bad block per failure mode so each is recognizable on its own.\n` +
		`\n` +
		`5. **Cross-link related rules.** Inside the note body, mention adjacent topics\n` +
		`   by wikilink. At the bottom of the note, add a \`See also:\` line listing\n` +
		`   related notes and a \`Part of [[<section>/<section>|<Section>]]\`\n` +
		`   backreference so the navigation tree closes cleanly.\n` +
		`\n` +
		`Goal: an agent landing on a single rule sees the principle, the reasoning, and\n` +
		`concrete code without scrolling, and knows where to follow up if the rule\n` +
		`intersects another topic.\n` +
		`\n` +
		`## Wikilink Format\n` +
		`\n` +
		`Cross-references between notes use full-path wikilinks with a display label,\n` +
		`not bare names:\n` +
		`\n` +
		"```\n" +
		`// Good — full path survives renames elsewhere; label keeps prose readable\n` +
		`[[coding-playbook/foundations/conventions|Conventions]]\n` +
		`\n` +
		`// Bad — bare name is ambiguous if any other note in the vault shares the title\n` +
		`[[Conventions]]\n` +
		"```\n" +
		`\n` +
		`This applies everywhere wikilinks appear: inline references inside child\n` +
		`notes, \`## Subnotes\` table rows in section hubs, \`## Sections\` and \`## Contents\`\n` +
		`entries in the root hub, \`See also:\` lines, and \`Part of\` backreferences.\n` +
		`\n` +
		`## Maintenance Methodology\n` +
		`\n` +
		`1. **Identify the change.** New convention, new child note, new section, rename,\n` +
		`   removal, or general audit. Skip if the user already named it.\n` +
		`\n` +
		`2. **Locate the right layer.** Read the root hub. New conventions usually extend\n` +
		`   an existing child note or land as a new child note inside an existing section.\n` +
		`   Only justify a new section when the topic isn't covered by any existing one.\n` +
		`\n` +
		`3. **Apply the change at the layer it belongs to.**\n` +
		`   - **Edit a child note** for changes inside an existing topic. Follow the\n` +
		`     Entry Format above — rule, reason, real code, Good/Bad pair, cross-links.\n` +
		`     If the change introduces vocabulary an agent might search by, update the\n` +
		`     section hub's \`## Subnotes\` keywords for that note as well. If the edit\n` +
		`     pushes the note beyond a single topic, split it (see Note Scope above).\n` +
		`   - **Add a child note.** Write it using the Entry Format for every rule it\n` +
		`     contains. Add a row to the section hub's \`## Subnotes\` table with\n` +
		`     keywords, append its path to the root hub's \`## Contents\` list, and —\n` +
		`     critically — retrofit the \`See also:\` lines of related existing notes to\n` +
		`     link to the new one. A note that's only reachable from its section hub is\n` +
		`     half-orphaned; agents discover related rules by following neighbor links.\n` +
		`   - **Add a section.** Create \`<section>/<section>.md\` shaped like existing\n` +
		`     section hubs (\`## Subnotes\`, \`## When to Read This Section\`, the\n` +
		`     \`Part of [[coding-playbook/coding-playbook|Coding Playbook]]\`\n` +
		`     backreference, hub frontmatter tags) — and remember section hubs hold\n` +
		`     navigation only, no patterns. Add the section to the root hub's\n` +
		`     \`## Sections\` list with a description, append every child note to\n` +
		`     \`## Contents\`, and add task-domain rows to \`## Task Routing\`.\n` +
		`   - **Rename or remove** a section or child note. Update the section hub, the\n` +
		`     root hub's \`## Sections\` and \`## Contents\`, every wikilink in adjacent\n` +
		`     notes that points at the renamed/removed target (including \`See also:\`\n` +
		`     lines), and the \`## Task Routing\` table.\n` +
		`\n` +
		`4. **Routing-table drift check (required).** Compare the root hub's\n` +
		`   \`## Task Routing\` table against the sections that exist. Each row should point\n` +
		`   to a real section; each section should be reachable from at least one row;\n` +
		`   each new convention added in step 3 should have a row that routes to it.\n` +
		`   Offer to reconcile any drift.\n` +
		`\n` +
		`5. **Subnotes-table drift check (required when a section was touched).** Scan\n` +
		`   the section hub's \`## Subnotes\` table — every child note in \`<section>/\`\n` +
		`   should have a row, and every row should point to a note that still exists.\n` +
		`\n` +
		`6. **Confirm.** Summarize what changed in the child note(s), in the section hub,\n` +
		`   and in the root hub (Sections, Contents, Task Routing).\n` +
		`\n` +
		`<!-- aide-update-playbook-end -->\n` +
		`\n` +
		`<!-- aide-research-index-start -->\n` +
		`\n` +
		`# Research\n` +
		`\n` +
		`### Domains\n` +
		`\n` +
		`| Domain | Notes |\n` +
		`|--------|-------|\n` +
		`\n` +
		`### How to Use This Index\n` +
		`\n` +
		`Research notes are filed by domain. Each subdirectory holds notes for a single domain; read the domain hub before drilling into individual notes. Do not flat-search across every domain — the structure is the navigation.\n` +
		`\n` +
		`### Domain Hubs\n` +
		`\n` +
		`Add domain hubs here as your research grows. Each hub lives at \`<domain>/<domain>.md\` and lists its child notes with keywords.\n` +
		`\n` +
		`### Contents\n` +
		`\n` +
		`<!-- aide-research-index-end -->\n` +
		`\n` +
		`<!-- aide-kanban-index-start -->\n` +
		`\n` +
		kanbanIndexSeed +
		`\n` +
		`<!-- aide-kanban-index-end -->\n` +
		`\n` +
		`<!-- aide-kanban-create-start -->\n` +
		`\n` +
		kanbanCreateSeed +
		`\n` +
		`<!-- aide-kanban-create-end -->\n` +
		`\n` +
		`<!-- aide-kanban-work-start -->\n` +
		`\n` +
		kanbanWorkSeed +
		`\n` +
		`<!-- aide-kanban-work-end -->\n` +
		`\n` +
		`<!-- aide-kanban-manage-start -->\n` +
		`\n` +
		kanbanManageSeed +
		`\n` +
		`<!-- aide-kanban-manage-end -->\n` +
		`\n` +
		`<!-- aide-kanban-move-start -->\n` +
		`\n` +
		kanbanMoveSeed +
		`\n` +
		`<!-- aide-kanban-move-end -->\n` +
		`\n` +
		`<!-- aide-kanban-complete-start -->\n` +
		`\n` +
		kanbanCompleteSeed +
		`\n` +
		`<!-- aide-kanban-complete-end -->\n` +
		`\n` +
		`<!-- aide-kanban-stash-start -->\n` +
		`\n` +
		kanbanStashSeed +
		`\n` +
		`<!-- aide-kanban-stash-end -->\n` +
		`\n` +
		`<!-- aide-kanban-review-start -->\n` +
		`\n` +
		kanbanReviewSeed +
		`\n` +
		`<!-- aide-kanban-review-end -->`
	);
}
