# brain.aide Spec

`brain.aide` is the host project's brain configuration. It declares which MCP server to launch as the brain layer and carries the hand-written agent-facing instructions that explain how to use it. It lives at `.aide/config/brain.aide` and is the single source of truth for the host's brain wiring.

`brain.aide` is a config file, not an intent spec. Its frontmatter is a typed config object; its body is hand-written content the agent and install service read. The explicit divergence from the intent-spec family (`intent.aide`, `plan.aide`, `todo.aide`, `research.aide`) is load-bearing — see `## Divergence from intent specs` below.

## Format

```yaml
---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "@bitbonsai/mcpvault"
    - "<BRAIN_PATH>"
---

<!-- aide-orientation-start -->
Runtime briefing returned verbatim by `aide_brain`. Describes what the
brain is, which MCP tools to call, and the four entry-point artifacts the
agent should start from for any given task.
<!-- aide-orientation-end -->

<!-- aide-config-start -->
Integration-specific wiring flow, read live by `aide_brain({ kind: "config" })`.
Documents what argument shape `/aide:brain config` accepts for this backend,
the steps to resolve and land the path or token, how to run sync, and what
restart message to emit.
<!-- aide-config-end -->

<!-- aide-playbook-index-start -->
Install-time seed for the coding-playbook entry-point artifact. The install
service reads this section and writes it verbatim to
`coding-playbook/coding-playbook.md` in the brain.
<!-- aide-playbook-index-end -->

<!-- aide-study-playbook-start -->
Install-time seed for the study-playbook navigation guide. The install
service reads this section and writes it verbatim to
`coding-playbook/study-playbook.md` in the brain. Holds the
backend-specific playbook-navigation prose the `study-playbook` skill
points at.
<!-- aide-study-playbook-end -->

<!-- aide-update-playbook-start -->
Install-time seed for the playbook-maintenance methodology. The install
service reads this section and writes it verbatim to
`coding-playbook/update-playbook.md` in the brain.
<!-- aide-update-playbook-end -->

<!-- aide-research-index-start -->
Install-time seed for the research entry-point artifact. The install
service reads this section and writes it verbatim to
`research/research.md` in the brain.
<!-- aide-research-index-end -->
```

### Frontmatter fields

The schema is the minimum that still has real runtime consumers. Both fields are required.

- **`name`** — `string`. A human-readable label for the wired brain (e.g. `"obsidian"`, `"notion"`, `"company-wiki"`). The user reads it; the agent narrates it back in conversation ("I am connected to your `obsidian` brain"); the package never branches on its value. Two hosts may use the same `name` with structurally different launchers and that is fine — `name` is descriptive metadata, not a dispatch key.

- **`mcpServerConfig`** — `object`. The MCP server configuration that wires the brain into the host's toolchain. Sync writes this object byte-for-byte into `.mcp.json` under the fixed `brain` key. Its shape mirrors what `.mcp.json` expects under `mcpServers["brain"]` so sync passes it through without reshaping.
  - **`command`** — `string`. The executable to launch (e.g. `"npx"`, `"node"`, `"uvx"`).
  - **`args`** — `string[]`. Arguments passed to `command`. Carries the launcher invocation and the path or identifier inline. When no `brainPath` is supplied at scaffold time, the last element is the literal `<BRAIN_PATH>` placeholder — a signal to the user and to `/aide:brain config` that the brain has not yet been pointed at a real location. When `--brain-path` is supplied at scaffold time, the path lands inline and no placeholder is written.

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
- **Seed sections (3–6):** `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` are read by the install service once, at cold-install time, and written as files into the brain. After install, the brain owns those files; users edit them there. The install service knows no other sections — it reads only the seed quartet.

**Per-consumer section ownership.** Each section has a single designated consumer:

- `orientation` — owned by `aide_brain` (live; `kind: "orientation"`). Returns the content verbatim to the agent. This is where the user writes runtime usage instructions: which MCP tools to call, how to navigate the knowledge store, and what entry-point artifacts the brain contains.
- `config` — owned by `aide_brain` (live; `kind: "config"`). Returns the content verbatim to the integration-specific wiring flow that `/aide:brain config` executes. Documents what argument shape the backend accepts, how to resolve and land the target path or token, how to run sync, and what restart message to emit.
- `playbookIndex` — owned by `provisionBrain`. Read once at install time and written verbatim as `coding-playbook/coding-playbook.md` in the brain.
- `studyPlaybook` — owned by `provisionBrain`. Read once at install time and written verbatim as `coding-playbook/study-playbook.md` in the brain. Holds the backend-specific playbook-navigation prose the `study-playbook` skill points at.
- `updatePlaybook` — owned by `provisionBrain`. Read once at install time and written verbatim as `coding-playbook/update-playbook.md` in the brain. Seeds the playbook-maintenance methodology the `/aide:update-playbook` command reads via the brain.
- `researchIndex` — owned by `provisionBrain`. Read once at install time and written verbatim as `research/research.md` in the brain.

The sync verb and boot reporter read frontmatter only; all six body sections are irrelevant to them.

Cross-section reads violate the contract. `aide_brain` does not read `playbookIndex`, `studyPlaybook`, `updatePlaybook`, or `researchIndex`. The install service does not read `orientation` or `config`. Each consumer reads exactly its own section(s), nothing more.

**Closed grammar — strict failure on layout violations.** The parser returns `malformed-body` for any of the following:

- Missing pair — `"missing markers: <comma-separated list>"` naming all absent markers.
- Malformed or typo'd marker (uppercase, mixed-case, missing `aide-` prefix, extra whitespace) — `"unknown marker: <as-written>"`.
- Unmatched closer without a preceding opener — `"unmatched closing marker: ..."`.
- Unmatched opener without a following closer — `"unmatched opening marker: ..."`.
- Wrong section order — `"marker order violation: ..."`.
- Nested markers — `"nested marker: ..."`.

**Strict-failure migration policy.** There is no transitional read path. Pre-rework files (4-section files carrying `aide-prose-*`, `aide-playbook-*`, `aide-study-playbook-*`, and `aide-research-*` markers) return `malformed-body` naming all twelve new markers as missing — the parser sees only unknown markers where it expects the new names. No auto-injection, no rename rewrite, no `aide_upgrade` carve-out. Migration is a hand-edit: rename the four existing markers to their new names (`aide-prose-*` → `aide-orientation-*`, `aide-playbook-*` → `aide-playbook-index-*`, `aide-research-*` → `aide-research-index-*`; `aide-study-playbook-*` is unchanged) and insert the two new section pairs (`aide-config-*` between orientation and playbook-index, `aide-update-playbook-*` between study-playbook and research-index) with appropriate content.

Earlier migration classes follow the same strict-failure pattern: pre-pivot files whose body used heading-based organization return `malformed-body` naming all twelve missing markers; pre-amendment three-section files (prose, playbook, and research pairs present but missing study-playbook) return `malformed-body` naming the absent pair. The parser never guesses intent from headings. The strict-failure pattern is the invariant across all migration generations.

**Entry-point artifact bytes flow from the seed sections.** The `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` sections are the source of truth for the artifacts the install service writes. The package does not hold these bytes as inline TypeScript constants — they live in `brain.aide` where the user can see, edit, and own them in the scaffold.

## Substitution surface

The parser supports `${...}` interpolation of frontmatter field names inside `mcpServerConfig.args`. At sync time, any `${fieldName}` reference in `args` is expanded against the frontmatter's top-level fields and the resulting array is written into `.mcp.json`.

In the current schema, `name` is the only top-level field that resolves as a substitution source, so the surface is essentially dormant. The default scaffold makes no use of it — the path lives inline as a literal string (or as the `<BRAIN_PATH>` placeholder on a cold no-`brainPath` install). The interpolation surface remains for advanced users who want to DRY a value across positions.

The substitution surface is `mcpServerConfig.args` and only `mcpServerConfig.args`. It runs only at sync time. It NEVER applies to any body section. All six body sections return verbatim, byte-identical to what the user wrote between the recognized markers.

## aide_brain kind parameter

`aide_brain` accepts an optional `kind` parameter:

```ts
aide_brain({ kind?: "orientation" | "config" })
```

`kind` defaults to `"orientation"`. When `kind` is `"config"`, the tool returns the verbatim `<!-- aide-config-start -->` ... `<!-- aide-config-end -->` body section. Non-ok branches (`no-brain-aide`, `no-mcp-entry`, `mcp-drift`) return the same fixed remediation prose regardless of `kind`.

Seed-section kinds (`playbook-index`, `study-playbook`, `update-playbook`, `research-index`) are NOT exposed at runtime. `aide_brain` has no `kind` values for the seed sections because after install those sections become on-disk files in the brain that the agent reads directly via the brain's own MCP read tool. The seed bytes in `brain.aide` go dormant after the first install; the live source is the brain file.

## The `.aide/config/` directory contract

`brain.aide` lives inside `.aide/config/`, which is the canonical home of user-owned configuration files in every host project. The directory has a sharp ownership rule:

- **Scaffolded once.** `aide_init` creates `.aide/config/brain.aide` if it does not exist, pre-filled with the canonical default scaffold.
- **Never overwritten.** After the first write, the file belongs to the user forever. Neither `aide_init` nor `aide_upgrade` overwrites, patches, migrates, or otherwise mutates anything under `.aide/config/` on subsequent runs.
- **Boundary is the path.** The install/upgrade tooling reads the directory path itself as the ownership signal — there is no per-file allowlist. Any file the user puts under `.aide/config/` is safe from the package's install/upgrade machinery.

Files outside `.aide/config/` (the methodology docs at `.aide/docs/`, pipeline command templates, agent definitions, skills, every other artifact the package ships) are package-owned and re-installed on every init/upgrade.

`brain.aide` is the current inhabitant of `.aide/config/`; the convention is forward-compatible with future user-owned config files.

## Lifecycle

1. **Scaffolded** by `aide_init` on a cold install. The installer writes `.aide/config/brain.aide` pre-filled with the canonical Obsidian default — `name: obsidian`, an `mcpServerConfig` that launches `@bitbonsai/mcpvault` with the `<BRAIN_PATH>` placeholder as the final `args` element when no `brainPath` was supplied (or with the path inline when `--brain-path` was supplied), and six pre-filled body sections: an orientation section with runtime usage instructions, a config section with the Obsidian-specific wiring flow, a playbook-index section seeding the coding-playbook entry-point artifact, a study-playbook section seeding the navigation guide (holding the backend-specific playbook-navigation prose the `study-playbook` skill points at), an update-playbook section seeding the playbook-maintenance methodology, and a research-index section seeding the research entry-point artifact. A host that never edits this file gets a working brain UX out of the box.

2. **Edited** by the user directly. The file is the user's configuration surface; no CLI wraps edits. Retargeting the knowledge-store path, switching brains, swapping the MCP launcher, or rewriting any body section are all hand-edits to this one file. After the initial scaffold, `aide_init` and `aide_upgrade` will never touch it.

3. **Propagated** to `.mcp.json` by `npx aidemd-mcp sync`. The user runs this after editing `brain.aide`. Sync reads the frontmatter, expands any `${...}` interpolations in `mcpServerConfig.args` (the default scaffold has none), and writes the resulting object into `.mcp.json` under the fixed `brain` key. This is the only mechanism that mutates `.mcp.json`'s brain entry.

4. **Restart Claude Code** so the new MCP server loads. MCP server registration is read at client startup; an edit + sync without a restart leaves the running session pointing at the previous brain.

5. **Drift detected** by the boot reporter. At session start, the reporter compares the `brain` entry in `.mcp.json` against the values declared in `brain.aide`. If they disagree, the reporter surfaces `mcp-drift`. The orchestrator treats drift as a hard halt: it does not proceed, does not attempt self-repair, and directs the user to run `npx aidemd-mcp sync`.

Re-running sync against an unchanged `brain.aide` is idempotent — it reads the file, computes the same target object, sees `.mcp.json` already matches, and exits reporting no change.

## Boot reporter brain status states

The boot reporter surfaces exactly four brain status states. The orchestrator reads the state and decides whether the pipeline can advance.

- **`ok`** — `.aide/config/brain.aide` exists, `.mcp.json` has a `brain` entry, and the two agree. The pipeline proceeds.

- **`no-brain-aide`** — `.aide/config/brain.aide` does not exist on disk. Remediation: run `npx aidemd-mcp init` (cold install) to scaffold the canonical default — the scaffold lands with `<BRAIN_PATH>` as the placeholder in `mcpServerConfig.args` until the user runs `/aide:brain config` to fill it in. Alternatively, hand-author the file if the host needs a custom brain. The orchestrator halts until the file is in place.

- **`no-mcp-entry`** — `brain.aide` exists, but `.mcp.json` has no `brain` entry under `mcpServers`. Remediation: run `npx aidemd-mcp sync` to write the entry from the source of truth, then restart Claude Code. The orchestrator halts until the wiring is in place.

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

- **All six body sections returned verbatim.** Each consumer reads its own owned section(s) and receives the bytes exactly as written. `aide_brain` returns `orientation` and `config` byte-identical to disk. The install service reads `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` byte-identical to disk. No server-side templating, no rendering pass, no variable substitution applies to any body section.

- **Per-consumer section ownership is exclusive.** `aide_brain` reads `orientation` and `config` only. The install service reads `playbookIndex`, `studyPlaybook`, `updatePlaybook`, and `researchIndex` only. The sync verb and boot reporter read frontmatter only. Cross-section reads — for example, `aide_brain` reading any seed section, or the install service reading `orientation` or `config` — violate the contract.

- **Live vs. seed split is enforced by consumer.** `aide_brain` has no knowledge of the seed sections; it does not surface them regardless of what `kind` is passed. The install service has no knowledge of the live sections; it does not read `orientation` or `config` regardless of what is in them.

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
