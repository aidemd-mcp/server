# brain.aide Spec

`brain.aide` is the host project's brain configuration. It declares which MCP server to launch as the brain layer and carries the hand-written agent-facing instructions that explain how to use it. It lives at `.aide/config/brain.aide` and is the single source of truth for the host's brain wiring.

`brain.aide` is a config file, not an intent spec. Its frontmatter is a typed config object; its body is hand-written content read live by `aide_brain` (orientation + config sections) and read by the integration's `aide-config` prose at first `/aide:brain config` (the four seed sections, written into the brain via the brain's own MCP write tool). The explicit divergence from the intent-spec family (`intent.aide`, `plan.aide`, `todo.aide`, `research.aide`) is load-bearing — see `## Divergence from intent specs` below.

## Format

```yaml
---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    -
---

<!-- aide-orientation-start -->
Runtime briefing returned verbatim by `aide_brain`. Describes what the
brain is, which MCP tools to call, and the four entry-point artifacts the
agent should start from for any given task.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
Integration-specific wiring flow, read live by `aide_brain({ kind: "config" })`.
Documents which arg index in `mcpServerConfig.args` is the unwired slot the
user must fill, how to resolve and land that value, how to run sync, how
to seed the four entry-point artifacts into the brain via the brain's own
MCP write tool from the seed-section bytes, and what restart message to
emit.
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
Install-time seed for the coding-playbook entry-point artifact. The
integration's `aide-config` body section prose reads this section at first
`/aide:brain config` and writes it verbatim to
`coding-playbook/coding-playbook.md` in the brain via the brain's own
MCP write tool.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
Install-time seed for the study-playbook navigation guide. The
integration's `aide-config` prose reads this section at first
`/aide:brain config` and writes it verbatim to
`coding-playbook/study-playbook.md` in the brain. Holds the
backend-specific playbook-navigation prose the `study-playbook` skill
points at.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
Install-time seed for the playbook-maintenance methodology. The
integration's `aide-config` prose reads this section at first
`/aide:brain config` and writes it verbatim to
`coding-playbook/update-playbook.md` in the brain.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
Install-time seed for the research entry-point artifact. The
integration's `aide-config` prose reads this section at first
`/aide:brain config` and writes it verbatim to `research/research.md`
in the brain.
<!-- aide-research-index-end -->
```

### Frontmatter fields

The schema is the minimum that still has real runtime consumers. Both fields are required.

- **`name`** — `string`. A human-readable label for the wired brain (e.g. `"obsidian"`, `"notion"`, `"company-wiki"`). The user reads it; the agent narrates it back in conversation ("I am connected to your `obsidian` brain"); the package never branches on its value. Two hosts may use the same `name` with structurally different launchers and that is fine — `name` is descriptive metadata, not a dispatch key.

- **`mcpServerConfig`** — `object`. The MCP server configuration that wires the brain into the host's toolchain. Sync writes this object byte-for-byte into `.mcp.json` under the fixed `brain` key. Its shape mirrors what `.mcp.json` expects under `mcpServers["brain"]` so sync passes it through without reshaping.
  - **`command`** — `string`. The executable to launch (e.g. `"npx"`, `"node"`, `"uvx"`).
  - **`args`** — `(string | null)[]`. Arguments passed to `command`. Every element is either a fully-formed argument string OR YAML null. A YAML null at any index is the explicit unwired-slot signal — the user must fill that slot via `/aide:brain config` before sync will write the brain entry into `.mcp.json`. The default scaffold's bundled `obsidianBrainAideTemplate()` emits YAML null at `args[3]` (or the platform-equivalent path slot); the integration's `aide-config` body section is the only place that documents which arg index means what for that backend. The package never introspects which slot is which. There is no literal-string placeholder — `<BRAIN_PATH>`, `<API_TOKEN>`, magic UUIDs, and any other in-band sentinel design have been retired in favor of structural YAML null.

That is the complete schema. There are no other top-level fields. A `connector`, `rootPath`, `entryFile`, or `tools` field — all of which a prior schema required — is rejected by the parser as `malformed-frontmatter`. Each retired field was validation theater: it existed for the parser to check, with no code path that consumed its value at runtime.

The parsed `ok` result flattens all fields as siblings: `{ kind: "ok", name, mcpServerConfig, orientation, config, playbookIndex, studyPlaybook, updatePlaybook, researchIndex }`. There is no `config: BrainAideConfig` wrapper — frontmatter fields and body fields appear at the same level on the result object.

### Body shape

The body is SIX marker-bounded sections in fixed order:

1. `<!-- aide-orientation-start -->` ... `<!-- aide-orientation-end -->`
2. `<!-- aide-config-start -->` ... `<!-- aide-config-end -->`
3. `<!-- aide-playbook-index-start -->` ... `<!-- aide-playbook-index-end -->`
4. `<!-- aide-study-playbook-start -->` ... `<!-- aide-study-playbook-end -->`
5. `<!-- aide-update-playbook-start -->` ... `<!-- aide-update-playbook-end -->`
6. `<!-- aide-research-index-start -->` ... `<!-- aide-research-index-end -->`

**Marker grammar.** Twelve markers total, six open/close pairs. Markers are lowercase, case-sensitive, with single ASCII spaces around the token — `<!-- aide-orientation-start -->` is valid; `<!--aide-orientation-start-->`, `<!-- Aide-Orientation-Start -->`, and `<!-- orientation-start -->` are not. The fixed order is orientation → config → playbook-index → study-playbook → update-playbook → research-index; any other order is a violation. Bytes outside any marker pair are silently ignored — blank lines between sections are fine and do not affect parsing.

**Live vs. seed split.** The six sections divide into two categories by consumer:

- **Live sections (1–2):** `orientation` and `config` are read by `aide_brain` at runtime. They live in `brain.aide` permanently and are returned verbatim on demand. `aide_brain` knows no other sections — it reads only the live pair.
- **Seed sections (3–6):** `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` are read by the integration's `aide-config` body section prose at first `/aide:brain config` — after the user fills the unwired slot(s) and runs sync — and written as files into the brain via the brain's own MCP write tool (e.g. `mcp__brain__write_note` for the bundled Obsidian default). After seeding, the brain owns those files; users edit them there. The package's code path never reads or writes the seed sections — `provisionBrain` stops at scaffolding `brain.aide` and planning the `.mcp.json` brain entry.

**Per-consumer section ownership.** Each section has a single designated consumer:

- `orientation` — owned by `aide_brain` (live; `kind: "orientation"`). Returns the content verbatim to the agent. This is where the user writes runtime usage instructions: which MCP tools to call, how to navigate the knowledge store, and what entry-point artifacts the brain contains.
- `config` — owned by `aide_brain` (live; `kind: "config"`). Returns the content verbatim to the integration-specific wiring flow that `/aide:brain config` executes. Documents which arg index is the unwired slot, how to resolve and land its value, how to run sync, how to seed the four entry-point artifacts via the brain's own MCP write tool, and what restart message to emit.
- `playbookIndex` — owned by the integration's `aide-config` prose. Read at first `/aide:brain config` (after sync) via `parseBrainAide`'s typed key and written verbatim as `coding-playbook/coding-playbook.md` in the brain via the brain's own MCP write tool.
- `studyPlaybook` — owned by the integration's `aide-config` prose. Read at first `/aide:brain config` and written verbatim as `coding-playbook/study-playbook.md` in the brain. Holds the backend-specific playbook-navigation prose the `study-playbook` skill points at.
- `updatePlaybook` — owned by the integration's `aide-config` prose. Read at first `/aide:brain config` and written verbatim as `coding-playbook/update-playbook.md` in the brain. Seeds the playbook-maintenance methodology the `/aide:update-playbook` command reads via the brain.
- `researchIndex` — owned by the integration's `aide-config` prose. Read at first `/aide:brain config` and written verbatim as `research/research.md` in the brain.

The sync verb and boot reporter read frontmatter only; all six body sections are irrelevant to them. `provisionBrain` reads frontmatter only too — its 2-step pipeline scaffolds `brain.aide` and plans the `.mcp.json` brain entry without ever opening a body section.

Cross-section reads violate the contract. `aide_brain` does not read `playbookIndex`, `studyPlaybook`, `updatePlaybook`, or `researchIndex`. The integration's `aide-config` prose does not read `orientation` (it reads its own section as part of being executed verbatim, but it does not read the `orientation` section). Each consumer reads exactly its own section(s), nothing more.

**Closed grammar — strict failure on layout violations.** The parser returns `malformed-body` for any of the following:

- Missing pair — `"missing markers: <comma-separated list>"` naming all absent markers.
- Malformed or typo'd marker (uppercase, mixed-case, missing `aide-` prefix, extra whitespace) — `"unknown marker: <as-written>"`.
- Unmatched closer without a preceding opener — `"unmatched closing marker: ..."`.
- Unmatched opener without a following closer — `"unmatched opening marker: ..."`.
- Wrong section order — `"marker order violation: ..."`.
- Nested markers — `"nested marker: ..."`.

**Strict-failure migration policy.** There is no transitional read path. Pre-rework files (4-section files carrying `aide-prose-*`, `aide-playbook-*`, `aide-study-playbook-*`, and `aide-research-*` markers) return `malformed-body` naming all twelve new markers as missing — the parser sees only unknown markers where it expects the new names. No auto-injection, no rename rewrite, no `aide_upgrade` carve-out. Migration is a hand-edit: rename the four existing markers to their new names (`aide-prose-*` → `aide-orientation-*`, `aide-playbook-*` → `aide-playbook-index-*`, `aide-research-*` → `aide-research-index-*`; `aide-study-playbook-*` is unchanged) and insert the two new section pairs (`aide-config-*` between orientation and playbook-index, `aide-update-playbook-*` between study-playbook and research-index) with appropriate content.

Earlier migration classes follow the same strict-failure pattern: pre-pivot files whose body used heading-based organization return `malformed-body` naming all twelve missing markers; pre-amendment three-section files (prose, playbook, and research pairs present but missing study-playbook) return `malformed-body` naming the absent pair. The parser never guesses intent from headings. The strict-failure pattern is the invariant across all migration generations.

**Entry-point artifact bytes flow from the seed sections.** The `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` sections are the source of truth for the artifacts the integration's `aide-config` prose seeds into the brain at first `/aide:brain config`. The package does not hold these bytes as inline TypeScript constants — they live in `brain.aide` where the user can see, edit, and own them in the scaffold. No package code path writes the artifacts to disk; the integration's prose owns the writes via the brain's own MCP write tool.

## Substitution surface

The parser supports `${...}` interpolation of frontmatter field names inside `mcpServerConfig.args`. At sync time, any `${fieldName}` reference in `args` is expanded against the frontmatter's top-level fields and the resulting array is written into `.mcp.json`.

In the current schema, `name` is the only top-level field that resolves as a substitution source, so the surface is essentially dormant. The default scaffold makes no use of it — the path lives inline as a literal string after the user fills the unwired slot, or as YAML null at the unwired slot before that. The interpolation surface remains for advanced users who want to DRY a value across positions.

YAML null entries in `mcpServerConfig.args` pass through `interpolateArgs` unchanged at the same index — null is not a string, so there is no `${...}` reference to expand. Sync's null-refusal precondition catches null-bearing args before they reach `.mcp.json`; sync never writes null into the launch command.

The substitution surface is `mcpServerConfig.args` and only `mcpServerConfig.args`. It runs only at sync time. It NEVER applies to any body section. All six body sections return verbatim, byte-identical to what the user wrote between the recognized markers.

## aide_brain kind parameter

`aide_brain` accepts an optional `kind` parameter:

```ts
aide_brain({ kind?: "orientation" | "config" })
```

`kind` defaults to `"orientation"`. When `kind` is `"config"`, the tool returns the verbatim `<!-- aide-config-start -->` ... `<!-- aide-config-end -->` body section. Non-ok branches (`no-brain-aide`, `no-mcp-entry`, `mcp-drift`) return the same fixed remediation prose regardless of `kind`.

Seed-section kinds (`playbook-index`, `study-playbook`, `update-playbook`, `research-index`) are NOT exposed at runtime. `aide_brain` has no `kind` values for the seed sections because after the integration's `aide-config` prose seeds them into the brain at first `/aide:brain config`, those sections become on-disk files in the brain that the agent reads directly via the brain's own MCP read tool. The seed bytes in `brain.aide` go dormant after the first seed pass; the live source is the brain file.

## The `.aide/config/` directory contract

`brain.aide` lives inside `.aide/config/`, which is the canonical home of user-owned configuration files in every host project. The directory has a sharp ownership rule:

- **Scaffolded once.** `aide_init` (and `cli/init` at cold install) creates `.aide/config/brain.aide` if it does not exist, pre-filled with the bundled template selected by `--brain <integration>` (default: the obsidian-flavored `obsidianBrainAideTemplate()`).
- **Never overwritten.** After the first write, the file belongs to the user forever. Neither `aide_init` nor `aide_upgrade` overwrites, patches, migrates, or otherwise mutates anything under `.aide/config/` on subsequent runs.
- **Boundary is the path.** The install/upgrade tooling reads the directory path itself as the ownership signal — there is no per-file allowlist. Any file the user puts under `.aide/config/` is safe from the package's install/upgrade machinery.

Files outside `.aide/config/` (the methodology docs at `.aide/docs/`, pipeline command templates, agent definitions, skills, every other artifact the package ships) are package-owned and re-installed on every init/upgrade.

`brain.aide` is the current inhabitant of `.aide/config/`; the convention is forward-compatible with future user-owned config files.

## Lifecycle

1. **Scaffolded** by `cli/init` on cold install (`npx aidemd-mcp init` with optional `--brain <integration>`, default `obsidian`), and by `aide_init({ category: "brain" })` on first `/aide:brain config` for missing-`brain.aide` self-heal. Both paths write `.aide/config/brain.aide` pre-filled with the bundled template — for the default Obsidian template: `name: obsidian`, an `mcpServerConfig` that launches `@bitbonsai/mcpvault` with YAML null at the path slot until the user fills it via `/aide:brain config`, and six pre-filled body sections (orientation, config, playbook-index, study-playbook, update-playbook, research-index). A host that runs `cli/init` and then `/aide:brain config` gets a working brain UX out of the box.

2. **Filled** by the user via `/aide:brain config`. The integration's `aide-config` body section prose runs, asks the user for whatever values the YAML-null slots need (e.g. the brain root path for the bundled Obsidian default), and edits `brain.aide` to land the resolved values into the args slots. Subsequent retargeting, switching brains, swapping the MCP launcher, or rewriting any body section are also hand-edits to this one file. After the initial scaffold, `aide_init` and `aide_upgrade` will never touch it.

3. **Propagated** to `.mcp.json` by `npx aidemd-mcp sync`. The user runs this after the slot-filling step. Sync reads the frontmatter, expands any `${...}` interpolations in `mcpServerConfig.args` (the default scaffold has none), and writes the resulting object into `.mcp.json` under the fixed `brain` key. Sync refuses null-bearing args: if any element of `mcpServerConfig.args` is still null, sync exits non-zero and routes the user back to `/aide:brain config`. Sync is the only mechanism that mutates `.mcp.json`'s brain entry.

4. **Entry-point artifacts seeded** by the integration's `aide-config` prose, after sync passes. The prose reads the four seed sections from `brain.aide` via `parseBrainAide`'s typed keys (`playbookIndex`, `studyPlaybook`, `updatePlaybook`, `researchIndex`) and writes each artifact into the brain via the brain's own MCP write tool (e.g. `mcp__brain__write_note` for Obsidian) at integration-specific paths. The presence-check + re-seed loop owns missing-artifact recovery on every `/aide:brain config` invocation.

5. **Restart Claude Code** so the new MCP server loads. MCP server registration is read at client startup; an edit + sync without a restart leaves the running session pointing at the previous brain.

6. **Drift detected** by the boot reporter. At session start, the reporter compares the `brain` entry in `.mcp.json` against the values declared in `brain.aide`. If they disagree, the reporter surfaces `mcp-drift`. The orchestrator treats drift as a hard halt: it does not proceed, does not attempt self-repair, and directs the user to run `npx aidemd-mcp sync`.

Re-running sync against an unchanged `brain.aide` is idempotent — it reads the file, computes the same target object, sees `.mcp.json` already matches, and exits reporting no change.

## Boot reporter brain status states

The boot reporter surfaces exactly four brain status states. The orchestrator reads the state and decides whether the pipeline can advance.

- **`ok`** — `.aide/config/brain.aide` exists, `.mcp.json` has a `brain` entry, and the two agree. The pipeline proceeds.

- **`no-brain-aide`** — `.aide/config/brain.aide` does not exist on disk. Remediation: run `npx aidemd-mcp init` (cold install) to scaffold the bundled template — the scaffold lands with YAML null at the unwired slot(s) of `mcpServerConfig.args` until the user runs `/aide:brain config` to fill them in. Alternatively, hand-author the file if the host needs a custom brain. The orchestrator halts until the file is in place.

- **`no-mcp-entry`** — `brain.aide` exists, but `.mcp.json` has no `brain` entry under `mcpServers`, OR `mcpServerConfig.args` carries one or more YAML null entries (a null-bearing config is by definition not a wireable launch command, so it collapses semantically into `no-mcp-entry`). Remediation: run `/aide:brain config` to fill any null slots and then run `npx aidemd-mcp sync` to write the entry from the source of truth, then restart Claude Code. The orchestrator halts until the wiring is in place.

- **`mcp-drift`** — both `brain.aide` and the `.mcp.json` `brain` entry exist, but their values disagree (the `command` differs, the `args` differ, or the user hand-edited `.mcp.json` away from what `brain.aide` declares). Remediation: run `npx aidemd-mcp sync` to bring `.mcp.json` back in line with the source of truth, then restart Claude Code. The orchestrator halts until the two agree. The boot reporter never auto-repairs drift — auto-repair would shift a load-bearing contract surface out from under the user and erase any deliberate hand-edit they made.

## Divergence from intent specs

`brain.aide` shares its file extension with the intent-spec family but is not an intent spec. The following fields the intent-spec template requires are explicitly absent:

- **No `scope`** — `brain.aide` has no scope boundary. It is a project-wide config file; scoping it to a subdirectory has no meaning.
- **No `intent` paragraph** — `brain.aide` does not describe desired behavior for an agent to implement. It is runtime configuration, not an engineering contract.
- **No `outcomes` block** — there are no desired or undesired outcomes to specify. The file's "outcome" is simply that the brain is correctly wired; correctness is verified by the boot reporter, not by an outcomes list.
- **No `description` field** — intent specs use `description` to name what the module does; `brain.aide` uses `name` to label the brain type, which is descriptive metadata, not a description of what code does.
- **No `status` lifecycle field** — intent specs track `draft`, `aligned`, `in-progress`, `done`; `brain.aide` has no lifecycle phases of that kind. It is always "the current config."

**Rationale.** Brain configuration is runtime configuration; intent specs are engineering contracts. Conflating the two erodes the methodology's central distinction — every downstream agent that reads both types would have to decide which rules apply. The absence of intent-spec fields from `brain.aide` is a hard boundary, not an oversight.

## Rules

- **All six body sections returned verbatim.** Each consumer reads its own owned section(s) and receives the bytes exactly as written. `aide_brain` returns `orientation` and `config` byte-identical to disk. The integration's `aide-config` prose reads `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` byte-identical to disk via `parseBrainAide`'s typed keys. No server-side templating, no rendering pass, no variable substitution applies to any body section.

- **Per-consumer section ownership is exclusive.** `aide_brain` reads `orientation` and `config` only. The integration's `aide-config` prose reads `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` only. The sync verb, boot reporter, and `provisionBrain` all read frontmatter only. Cross-section reads — `aide_brain` reading any seed section, or any package code path reading the seed sections — violate the contract.

- **Live vs. seed split is enforced by consumer.** `aide_brain` has no knowledge of the seed sections; it does not surface them regardless of what `kind` is passed. `provisionBrain` has no knowledge of any body section; its 2-step pipeline scaffolds `brain.aide` and plans the `.mcp.json` brain entry without ever opening a body section.

- **`mcpServerConfig.args` interpolation runs only at sync time.** Any `${fieldName}` references in `args` are expanded by `npx aidemd-mcp sync` against the frontmatter and written into `.mcp.json`. They are never expanded at read time, at server startup, or inside any body section.

- **The brain's interface contract is the `orientation` section, not the schema.** The frontmatter does not declare expected MCP tool names, expected operations, or expected entry-point paths. The agent reads the `orientation` section verbatim, calls whatever MCP tools it names, and surfaces failures fast. A frontmatter field whose only consumer is the parser's own validation is rejected.

- **`name` is descriptive metadata, never dispatched on.** No code in this package branches on the value of `name`. The field exists so a human reading the file immediately knows what kind of brain is wired and so the agent can narrate its connection in conversation. Introducing any code path that switches on `name` re-introduces the in-code backend registry this architecture rejects.

- **Adding a new brain is a host-side edit + sync, never a code change to this package.** The package has no opinion about which brain a host runs — only about how the host declares it. A new brain = edit `brain.aide`, run `npx aidemd-mcp sync`, restart Claude Code.

- **Drift is a hard halt.** When the boot reporter surfaces `mcp-drift`, the orchestrator stops. It does not auto-repair. It directs the user to run sync.

- **The `.mcp.json` brain key is fixed.** Sync always writes to `mcpServers["brain"]`. The key name is not configurable; downstream tooling, the boot reporter, and the orchestrator all read from the same fixed name.

- **`.aide/config/` is user-owned forever.** After the first scaffold, neither `aide_init` nor `aide_upgrade` touches anything under `.aide/config/`. New defaults reach existing hosts only through sync or a deliberate user edit.

- **One file, one source of truth.** `brain.aide` is the single source of truth for brain configuration. The host's `.mcp.json` brain entry is a derived artifact — it must match `brain.aide` and is only updated by sync.

- **Strict-failure migration: no transitional read path.** Pre-rework files (4-section files carrying `aide-prose-*`, `aide-playbook-*`, `aide-study-playbook-*`, and `aide-research-*` markers) return `malformed-body` naming all twelve new markers as missing. Earlier migration classes (pre-pivot heading-based files, pre-amendment three-section files) follow the same pattern — the parser returns `malformed-body` naming the absent markers, never guesses intent from headings, and never auto-injects. Migration is a hand-edit in every case.

## Placement

`brain.aide` lives inside the `.aide/config/` directory at the project root:

```
.aide/
├── intent.aide        ← project intent spec
├── config/            ← user-owned configuration (never overwritten after scaffold)
│   └── brain.aide     ← brain configuration (this file type)
├── docs/              ← canonical methodology docs (package-owned, re-installed on init/upgrade)
│   └── brain-aide.md
└── ...
```

No cross-referencing between `brain.aide` and other `.aide` files is needed. The folder placement is the relationship: anything under `.aide/config/` is user-owned config; anything elsewhere under `.aide/` is methodology surface the package manages.
