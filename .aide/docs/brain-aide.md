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
    - "D:/notes/my-vault"
---

<!-- aide-prose-start -->
Hand-written agent-facing instructions. Returned verbatim by `aide_brain`.
The agent reads this section and follows it. Nothing in this package
interprets or transforms these sentences.
<!-- aide-prose-end -->

<!-- aide-playbook-start -->
Seed content for the coding-playbook entry-point artifact. The install
service reads this section and writes it verbatim to
`coding-playbook/coding-playbook.md` in the host project.
<!-- aide-playbook-end -->

<!-- aide-study-playbook-start -->
Seed content for the study-playbook entry-point artifact. The install
service reads this section and writes it verbatim to
`coding-playbook/study-playbook.md` in the host project. Holds the
backend-specific playbook-navigation prose (Step 1/2/3 process,
Navigation Rules with the depth-counting example, link-traversal
semantics) that the `study-playbook` skill points at.
<!-- aide-study-playbook-end -->

<!-- aide-research-start -->
Seed content for the research entry-point artifact. The install service
reads this section and writes it verbatim to `research/research.md` in
the host project.
<!-- aide-research-end -->
```

### Frontmatter fields

The schema is the minimum that still has real runtime consumers. Both fields are required.

- **`name`** — `string`. A human-readable label for the wired brain (e.g. `"obsidian"`, `"notion"`, `"company-wiki"`). The user reads it; the agent narrates it back in conversation ("I am connected to your `obsidian` brain"); the package never branches on its value. Two hosts may use the same `name` with structurally different launchers and that is fine — `name` is descriptive metadata, not a dispatch key.

- **`mcpServerConfig`** — `object`. The MCP server configuration that wires the brain into the host's toolchain. Sync writes this object byte-for-byte into `.mcp.json` under the fixed `brain` key. Its shape mirrors what `.mcp.json` expects under `mcpServers["brain"]` so sync passes it through without reshaping.
  - **`command`** — `string`. The executable to launch (e.g. `"npx"`, `"node"`, `"uvx"`).
  - **`args`** — `string[]`. Arguments passed to `command`. Carries the launcher invocation and the path or identifier inline. The default scaffold writes the path as a literal string in this list — no interpolation, no derived value.

That is the complete schema. There are no other top-level fields. A `connector`, `rootPath`, `entryFile`, or `tools` field — all of which the prior schema required — is now rejected by the parser as `malformed-frontmatter`. Each retired field was validation theater: it existed for the parser to check, with no code path that consumed its value at runtime. Anything an agent needs at runtime now lives in the prose body section, where the agent actually reads it.

### Body shape

The body is FOUR marker-bounded sections in fixed order:

1. `<!-- aide-prose-start -->` ... `<!-- aide-prose-end -->`
2. `<!-- aide-playbook-start -->` ... `<!-- aide-playbook-end -->`
3. `<!-- aide-study-playbook-start -->` ... `<!-- aide-study-playbook-end -->`
4. `<!-- aide-research-start -->` ... `<!-- aide-research-end -->`

**Marker grammar.** Eight markers total, four open/close pairs. Markers are lowercase, case-sensitive, with single ASCII spaces around the token — `<!-- aide-prose-start -->` is valid; `<!--aide-prose-start-->`, `<!-- Aide-Prose-Start -->`, and `<!-- prose-start -->` are not. The fixed order is `prose` then `playbook` then `studyPlaybook` then `research`; any other order is a violation. Bytes outside any marker pair are silently ignored — note-to-self comments or blank lines between sections are fine and do not affect parsing.

**Per-consumer section ownership.** Each section has a single designated consumer:

- `prose` — owned by the runtime brain tool (`aide_brain`). Returns the content verbatim to the agent at session start. This is where the user writes agent-facing usage instructions: which MCP tools to call, how to navigate the knowledge store, what conventions to follow.
- `playbook` — owned by the install service's brain provisioner (`provisionBrain`). Read once at install time and written verbatim as the coding-playbook entry-point artifact (`coding-playbook/coding-playbook.md`).
- `studyPlaybook` — owned by the install service's brain provisioner (`provisionBrain`). Read once at install time and written verbatim as the study-playbook entry-point artifact (`coding-playbook/study-playbook.md`). Holds the backend-specific playbook-navigation prose — the Step 1/2/3 process for using the playbook entry-point, the Navigation Rules block with the depth-counting example, and the link-traversal semantics — that the agent-side `study-playbook` skill points at. The skill itself stays minimal: it reads the on-disk study-playbook entry-point artifact and follows the navigation methodology it describes. The navigation methodology travels with the user-owned brain template, not with the package's release cycle.
- `research` — owned by the install service's brain provisioner (`provisionBrain`). Read once at install time and written verbatim as the research entry-point artifact (`research/research.md`).

The sync verb and boot reporter read frontmatter only; all four body sections are irrelevant to them.

Cross-section reads violate the contract. `aide_brain` does not read `playbook`, `studyPlaybook`, or `research`. The install service does not read `prose`. Each consumer reads exactly its own section, nothing more.

**Closed grammar — strict failure on layout violations.** The parser returns `malformed-body` for any of the following:

- Missing pair — `"missing markers: <comma-separated list>"` naming all absent markers.
- Malformed or typo'd marker (uppercase, mixed-case, missing `aide-` prefix, extra whitespace) — `"unknown marker: <as-written>"`.
- Unmatched closer without a preceding opener — `"unmatched closing marker: ..."`.
- Unmatched opener without a following closer — `"unmatched opening marker: ..."`.
- Wrong section order — `"marker order violation: ..."`.
- Nested markers — `"nested marker: ..."`.

**Strict-failure migration policy.** There is no transitional read path. Pre-pivot files whose body used heading-based organization (`## Prose`, `## Playbook hub`, `## Research hub`) return `malformed-body` naming all eight missing markers. Pre-amendment three-section marker-bounded files (prose, playbook, and research pairs present, but missing the `aide-study-playbook-start` / `aide-study-playbook-end` pair) return `malformed-body` naming the two missing markers specifically — there is no auto-injection and no `aide_upgrade` carve-out for this case. Migration is a hand-edit in either case: the user opens the file and adds the missing markers in the correct positions (between the playbook and research sections for the pre-amendment case), or copies the bundled scaffold and pastes their content into the appropriate sections. The parser never guesses intent from headings.

**Entry-point artifact bytes flow from the body sections.** The `playbook`, `studyPlaybook`, and `research` sections are the source of truth for the entry-point artifacts the install service writes. The package does not hold these bytes as inline TypeScript constants — they live in `brain.aide` where the user can see, edit, and own them.

## Substitution surface

The parser supports `${...}` interpolation of frontmatter field names inside `mcpServerConfig.args`. At sync time, any `${fieldName}` reference in `args` is expanded against the frontmatter's top-level fields and the resulting array is written into `.mcp.json`.

In the current schema, `name` is the only top-level field that resolves as a substitution source, so the surface is essentially dormant. The default scaffold makes no use of it — the path lives inline as a literal string. The interpolation surface remains for advanced users who want to DRY a value across positions, but it is not a feature the standard install exercises and most users will never touch it.

The substitution surface is `mcpServerConfig.args` and only `mcpServerConfig.args`. It runs only at sync time. It NEVER applies to any body section. All four body sections (`prose`, `playbook`, `studyPlaybook`, `research`) return verbatim, byte-identical to what the user wrote between the recognized markers. A brain whose prose section legitimately documents a templating language — for example, content that explains a knowledge store whose own syntax uses `${variable}` placeholders — can write those characters in the body without fear that the package will interpret or strip them.

## The `.aide/config/` directory contract

`brain.aide` lives inside `.aide/config/`, which is the canonical home of user-owned configuration files in every host project. The directory has a sharp ownership rule:

- **Scaffolded once.** `aide_init` creates `.aide/config/brain.aide` if it does not exist, pre-filled with the canonical Obsidian default.
- **Never overwritten.** After the first write, the file belongs to the user forever. Neither `aide_init` nor `aide_upgrade` overwrites, patches, migrates, or otherwise mutates anything under `.aide/config/` on subsequent runs.
- **Boundary is the path.** The install/upgrade tooling reads the directory path itself as the ownership signal — there is no per-file allowlist. Any file the user puts under `.aide/config/` is safe from the package's install/upgrade machinery.

Files outside `.aide/config/` (the methodology docs at `.aide/docs/`, pipeline command templates, agent definitions, skills, every other artifact the package ships) are package-owned and re-installed on every init/upgrade. New defaults reach existing hosts only through the sync verb or a deliberate user edit, never through the install or upgrade path.

`brain.aide` is the current inhabitant of `.aide/config/`; the convention is forward-compatible with future user-owned config files.

## Lifecycle

1. **Scaffolded** by `aide_init` on a cold install. The installer writes `.aide/config/brain.aide` pre-filled with the canonical Obsidian default — `name: obsidian`, an `mcpServerConfig` that launches `@bitbonsai/mcpvault` against the user's resolved knowledge-store path, and four pre-filled body sections: a prose section with agent usage instructions, a playbook section seeding the coding-playbook entry-point artifact, a studyPlaybook section seeding the study-playbook entry-point artifact (holding the backend-specific playbook-navigation prose the `study-playbook` skill points at), and a research section seeding the research entry-point artifact. A host that never edits this file gets a working brain UX out of the box.

2. **Edited** by the user directly. The file is the user's configuration surface; no CLI wraps edits. Retargeting the knowledge-store path, switching brains, swapping the MCP launcher, or rewriting any body section are all hand-edits to this one file. After the initial scaffold, `aide_init` and `aide_upgrade` will never touch it.

3. **Propagated** to `.mcp.json` by `npx aidemd-mcp sync`. The user runs this after editing `brain.aide`. Sync reads the frontmatter, expands any `${...}` interpolations in `mcpServerConfig.args` (the default scaffold has none), and writes the resulting object into `.mcp.json` under the fixed `brain` key. This is the only mechanism that mutates `.mcp.json`'s brain entry; the MCP server never silently rewrites the host's MCP wiring.

4. **Restart Claude Code** so the new MCP server loads. MCP server registration is read at client startup; an edit + sync without a restart leaves the running session pointing at the previous brain.

5. **Drift detected** by the boot reporter. At session start, the reporter compares the `brain` entry in `.mcp.json` against the values declared in `brain.aide`. If they disagree, the reporter surfaces `mcp-drift`. The orchestrator treats drift as a hard halt: it does not proceed, does not attempt self-repair, and directs the user to run `npx aidemd-mcp sync`.

Re-running sync against an unchanged `brain.aide` is idempotent — it reads the file, computes the same target object, sees `.mcp.json` already matches, and exits reporting no change.

## Boot reporter brain status states

The boot reporter surfaces exactly four brain status states. The orchestrator reads the state and decides whether the pipeline can advance.

- **`ok`** — `.aide/config/brain.aide` exists, `.mcp.json` has a `brain` entry, and the two agree. The pipeline proceeds.

- **`no-brain-aide`** — `.aide/config/brain.aide` does not exist on disk. Remediation: run `npx aidemd-mcp init` (cold install) to scaffold the canonical default, or hand-author the file if the host needs a custom brain. The orchestrator halts until the file is in place.

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

- **All four body sections returned verbatim.** Each consumer reads its own owned section and receives the bytes exactly as written. `aide_brain` returns the prose section byte-identical to disk. The install service reads the playbook, studyPlaybook, and research sections byte-identical to disk. No server-side templating, no rendering pass, no variable substitution applies to any body section.

- **Per-consumer section ownership is exclusive.** `aide_brain` reads `prose` only. The install service reads `playbook`, `studyPlaybook`, and `research` only. The sync verb and boot reporter read frontmatter only. Cross-section reads — for example, `aide_brain` reading `playbook` or `studyPlaybook`, or the install service reading `prose` — violate the contract.

- **`mcpServerConfig.args` interpolation runs only at sync time.** Any `${fieldName}` references in `args` are expanded by `npx aidemd-mcp sync` against the frontmatter and written into `.mcp.json`. They are never expanded at read time, at server startup, or inside any body section.

- **The brain's interface contract is the prose section, not the schema.** The frontmatter does not declare expected MCP tool names, expected operations, or expected entry-point paths. The agent reads the prose section verbatim, calls whatever MCP tools it names, and surfaces failures fast. A frontmatter field whose only consumer is the parser's own validation is rejected.

- **`name` is descriptive metadata, never dispatched on.** No code in this package branches on the value of `name`. The field exists so a human reading the file immediately knows what kind of brain is wired and so the agent can narrate its connection in conversation. Introducing any code path that switches on `name` re-introduces the in-code backend registry this architecture rejects.

- **Adding a new brain is a host-side edit + sync, never a code change to this package.** The package has no opinion about which brain a host runs — only about how the host declares it. A new brain = edit `brain.aide`, run `npx aidemd-mcp sync`, restart Claude Code.

- **Drift is a hard halt.** When the boot reporter surfaces `mcp-drift`, the orchestrator stops. It does not auto-repair. It directs the user to run sync.

- **The `.mcp.json` brain key is fixed.** Sync always writes to `mcpServers["brain"]`. The key name is not configurable; downstream tooling, the boot reporter, and the orchestrator all read from the same fixed name.

- **`.aide/config/` is user-owned forever.** After the first scaffold, neither `aide_init` nor `aide_upgrade` touches anything under `.aide/config/`. New defaults reach existing hosts only through sync or a deliberate user edit.

- **One file, one source of truth.** `brain.aide` is the single source of truth for brain configuration. The host's `.mcp.json` brain entry is a derived artifact — it must match `brain.aide` and is only updated by sync.

- **Strict-failure migration: no transitional read path.** Pre-pivot files whose body used heading-based organization (`## Prose`, `## Playbook hub`, `## Research hub`) return `malformed-body` naming all eight missing markers. Pre-amendment three-section marker-bounded files (the prose, playbook, and research pairs present but missing the `aide-study-playbook-start` / `aide-study-playbook-end` pair) return `malformed-body` naming the two missing markers specifically; there is no auto-injection and no `aide_upgrade` carve-out. The parser never guesses intent from headings. Migration is a hand-edit in either case: open the file, add the missing markers in the correct positions (between the playbook and research sections for the pre-amendment case, or add all eight markers for the pre-pivot case), and paste existing content into the appropriate sections.

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
