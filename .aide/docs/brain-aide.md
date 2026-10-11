# brain.aide Spec

`brain.aide` is the host project's brain configuration. It declares which MCP server to launch as the brain layer and carries the hand-written agent-facing instructions that explain how to use it. It lives at `.aide/config/brain.aide` and is the single source of truth for the host's brain wiring.

`brain.aide` is a config file, not an intent spec. Its frontmatter is a typed config object; its body is hand-written content that `aide_brain` returns one section at a time: the live sections at runtime, and the seed sections while `/aide:brain config` writes them into the brain via the brain's own MCP write tool at the paths the published contract names. The explicit divergence from the intent-spec family (`intent.aide`, `plan.aide`, `todo.aide`, `research.aide`) is load-bearing — see `## Divergence from intent specs` below.

## Format

```yaml
---
name: obsidian
mcpServerConfig:
  command: npx
  args:
    - "-y"
    - "@bitbonsai/mcpvault@0.16.0"
    -
---

<!-- aide-<marker>-start -->
...section body, written by the user...
<!-- aide-<marker>-end -->

<!-- ...one block per contract entry, in contract order. The section list,
     marker names and purposes come from the published contract (see Body
     shape below), not from this example... -->
```

### Frontmatter fields

The schema is the minimum that still has real runtime consumers. Both fields are required.

- **`name`** — `string`. A human-readable label for the wired brain (e.g. `"obsidian"`, `"notion"`, `"company-wiki"`). The user reads it; the agent narrates it back in conversation ("I am connected to your `obsidian` brain"); the package never branches on its value. Two hosts may use the same `name` with structurally different launchers and that is fine — `name` is descriptive metadata, not a dispatch key.

- **`mcpServerConfig`** — `object`. The MCP server configuration that wires the brain into the host's toolchain. Sync writes this object byte-for-byte into `.mcp.json` under the fixed `brain` key. Its shape mirrors what `.mcp.json` expects under `mcpServers["brain"]` so sync passes it through without reshaping.
  - **`command`** — `string`. The executable to launch (e.g. `"npx"`, `"node"`, `"uvx"`).
  - **`args`** — `(string | null)[]`. Arguments passed to `command`. Every element is either a fully-formed argument string OR YAML null. A YAML null at any index is the explicit unwired-slot signal — the user must fill that slot via `/aide:brain config` before sync will write the brain entry into `.mcp.json`. The default scaffold's bundled `obsidianBrainAideTemplate()` emits YAML null at `args[3]` (or the platform-equivalent path slot); the config section is the only place that documents which arg index means what for that backend. The package never introspects which slot is which. There is no literal-string placeholder — `<BRAIN_PATH>`, `<API_TOKEN>`, magic UUIDs, and any other in-band sentinel design have been retired in favor of structural YAML null.

That is the complete schema. There are no other top-level fields. A `connector`, `rootPath`, `entryFile`, or `tools` field — all of which a prior schema required — is rejected by the parser as `malformed-frontmatter`. Each retired field was validation theater: it existed for the parser to check, with no code path that consumed its value at runtime.

The parsed `ok` result flattens all fields as siblings: `{ kind: "ok", name, mcpServerConfig, ...one field per contract section }`. There is no `config: BrainAideConfig` wrapper — frontmatter fields and body fields appear at the same level on the result object, and the body field names come from the contract.

### Body shape

The body is a sequence of marker-bounded sections. The required sections are a **published contract with one source**: the server's brain contract. This doc teaches the model and deliberately does not copy the list, because a copy would drift from the parser that enforces it.

**Where agents read the contract.** `aide_init`'s `Brain config (brain.aide)` step carries `brainSummary.sections`: each section's `marker`, its `role` (`live` or `seed`), the brain-relative `seedPath` for seed sections, and the byte size of the template's version. The summary carries no section text and no purposes. A section's one-line `purpose` comes back from `aide_brain` alongside the section itself. The array order is the required body order, and new required sections append; existing entries never reorder.

**Marker grammar.** Every section is one open/close pair: `<!-- aide-<marker>-start -->` ... `<!-- aide-<marker>-end -->`, where `<marker>` is a contract entry's `marker`. Markers are lowercase and case-sensitive, with single ASCII spaces around the token: `<!-- aide-<marker>-start -->` is valid; `<!--aide-<marker>-start-->`, `<!-- Aide-<marker>-Start -->` and `<!-- <marker>-start -->` are not. Pairs appear in contract order; any other order is a violation. Bytes outside any marker pair are silently ignored, so blank lines between sections are fine and do not affect parsing.

**Any backend that satisfies the contract is valid.** A hand-written config for a different brain (a wiki, a notes API, a document store) is as valid as the bundled Obsidian template. Nothing depends on the template's wording or on the backend's identity: the parser checks the frontmatter shape and the contract's marker pairs, and nothing else.

**Live vs. seed split.** The contract's `role` field divides the sections by consumer:

- **Live sections** are read through `aide_brain` at runtime. They live in `brain.aide` permanently and are returned verbatim on demand.
- **Seed sections** are written into the brain by `/aide:brain config`, each at its contract `seedPath`, through the brain's own MCP write tool. The agent fetches each missing seed's bytes with `aide_brain`, one section per call. A seed write is skip-on-exists: a file already at that path is never fetched or overwritten. After seeding, the brain owns that file and users edit it there. The package never writes a seed into the brain; the seed bytes go dormant once the brain holds them.

**Kanban content is a seed, not a feature of the package.** The kanban board, a kanban index and one guide per kanban operation are ordinary seed sections: they land in the brain at their contract seed paths like any other seed, and after that the brain owns them. The package ships two kanban pieces, as a pair: the `kanban` pointer skill, installed with the other AIDE skills, and the `kanban-maintainer` board agent, installed with the other agents in its own `kanban/` agent folder. The skill names the kanban index in the brain and routes every board read and write to the agent; the agent reads the index and only the guide for the operation requested, so no agent reads procedures it does not need, and it reports compactly or carries out board changes the caller has already approved. Both work in any project and do not require running the AIDE pipeline. The procedures themselves stay seeds — the package ships no board procedures of its own. Each backend's template fills these sections in its own vocabulary; the bundled one is written for Obsidian.

**What each section is for.** The role decides who uses the bytes:

- A **live** section is used where it sits. The orientation section is where the user writes runtime usage instructions; the config section is the backend's wiring flow that `/aide:brain config` executes (which arg slot is unwired, how to land its value, how to run sync, how to seed the brain, what restart message to emit).
- A **seed** section is used once: `/aide:brain config` fetches it through `aide_brain` and writes it verbatim at the contract `seedPath`.

The sync verb and boot reporter read frontmatter only; the body sections are irrelevant to them. The install summary reports which sections are missing or stale by marker, never by their bytes.

**One section at a time.** `aide_brain` returns exactly the section requested, never other sections or the whole file. With it comes `found` (true only when the text is that section's bytes) and, when found, the section's `purpose` from the published contract. It reads a section on every status where the file exists and parses — healthy, missing sections, unwired, drifted — because seeding and repair happen exactly while the config is incomplete.

**Closed grammar: strict failure on layout violations.** The parser rejects structural faults among the marker pairs that are present, each as `malformed-body` with its reason:

- Malformed or typo'd marker (uppercase, mixed-case, missing `aide-` prefix, extra whitespace): `"unknown marker: <as-written>"`.
- Unmatched closer without a preceding opener: `"unmatched closing marker: ..."`.
- Unmatched opener without a following closer: `"unmatched opening marker: ..."`.
- Wrong section order: `"marker order violation: ..."`.
- Nested markers: `"nested marker: ..."`.

**Absent whole sections are a different result.** When every present pair is sound but one or more required pairs are absent entirely, the parser returns `missing-sections`, naming each absent section in contract order. It is not a `malformed-body` reason. Structural faults among the present sections take precedence: a file with both is reported as the structural fault, so the user fixes the structure before the gaps are filled. The distinction drives the boot status; see `## Boot reporter brain status states`.

**Outdated is reported, never silently accepted.** The policy for a present file that falls short of the contract:

- It is reported with its fault. The package never reads a short file as if it were complete.
- `/aide:brain config` repairs a `missing-sections` file after the user confirms, by calling `aide_upgrade` with `category: "brain"`. The tool inserts only the missing sections, byte-identical from the latest bundled template and in the file's line endings, and only when the config launches the template's own brain server. For any other backend it inserts nothing and names the sections, which the `aide-brain-author` skill then writes with the user for that backend. Existing sections, launcher wiring and customizations are never touched.
- Structural faults are shown to the user with the parser's reason, for hand repair. The package does not guess intent.
- Install never writes `.aide/config/` after the first scaffold, and upgrade writes the brain config only through the consent-gated brain category. See `## The .aide/config/ directory contract`.
- A retired-marker file (one whose sections use markers no contract entry names) reports every section as missing. There is no rename rewrite and no transitional read path.

**Seed bytes flow from the seed sections.** The seed sections are the source of truth for the artifacts the integration's `aide-config` prose writes into the brain at first `/aide:brain config`. The package does not hold these bytes as inline TypeScript constants; they live in `brain.aide` where the user can see, edit and own them in the scaffold. No package code path writes the artifacts to disk; the integration's prose owns the writes via the brain's own MCP write tool.

## Substitution surface

The parser supports `${...}` interpolation of frontmatter field names inside `mcpServerConfig.args`. At sync time, any `${fieldName}` reference in `args` is expanded against the frontmatter's top-level fields and the resulting array is written into `.mcp.json`.

In the current schema, `name` is the only top-level field that resolves as a substitution source, so the surface is essentially dormant. The default scaffold makes no use of it — the path lives inline as a literal string after the user fills the unwired slot, or as YAML null at the unwired slot before that. The interpolation surface remains for advanced users who want to DRY a value across positions.

YAML null entries in `mcpServerConfig.args` pass through `interpolateArgs` unchanged at the same index — null is not a string, so there is no `${...}` reference to expand. Sync's null-refusal precondition catches null-bearing args before they reach `.mcp.json`; sync never writes null into the launch command.

The substitution surface is `mcpServerConfig.args` and only `mcpServerConfig.args`. It runs only at sync time. It NEVER applies to any body section. All body sections return verbatim, byte-identical to what the user wrote between the recognized markers.

## aide_brain parameters

`aide_brain` is read-only. Its optional `source` picks what it reads; omitted, it reads the host's config:

```ts
aide_brain({ kind?: <any section marker in the published contract> })
// → { status, instructions, found, purpose? }
aide_brain({ source: "template", kind?: <marker> | "launcher" })
// → { template, purpose }
aide_brain({ source: "contract" })
// → { sections: { marker, role, purpose }[] }
aide_brain({ source: "draft", path: <project-relative path> })
// → { outcome: "valid" | "invalid" | "absent" | "refused", instructions, fault? }
```

- **Template read** returns one section, or the launcher (the frontmatter between the `---` fences), of the bundled template with its purpose, whatever state the host's config is in.
- **Contract listing** returns every section in contract order with its role and purpose, and no text.
- **Draft check** parses a draft config at a path inside the project with the same parser and fault wording as the host check, so a `valid` draft is structurally ready to swap in. A path outside the project is refused unread.

For a host read, `kind` defaults to `"orientation"`; any other contract marker, live or seed, selects that section, and a value outside the contract is refused. The reply:

- **`found: true`** — `instructions` is the requested section's bytes between its marker pair, verbatim, and `purpose` is that section's one-line purpose from the published contract (never read from the user's file). This happens on every status where the file exists and parses: `ok`, `brain-aide-invalid` with that section present, `no-mcp-entry` and `mcp-drift`. `status` still reports the brain's real state.
- **`found: false`** — `instructions` is remediation and `purpose` is absent. An absent file (`no-brain-aide`) routes to `/aide:brain config`. A requested section missing from the file names `aide_upgrade` with `category: "brain"`, the call that inserts it. A malformed or unreadable file gives the parser's reason, a hand fix with the user, and a re-check with `aide_info`.

Callers branch on `found` for "did I get the section" and on `status` for "is the brain healthy". Once a seed is in the brain, agents read the brain file directly through the brain's own MCP read tool; the seed bytes in `brain.aide` go dormant.

## The `.aide/config/` directory contract

`brain.aide` lives inside `.aide/config/`, which is the canonical home of user-owned configuration files in every host project. The directory has a sharp ownership rule:

- **Scaffolded once.** `aide_init` (and `cli/init` at cold install) creates `.aide/config/brain.aide` if it does not exist, pre-filled with the bundled template selected by `--brain <integration>` (default: the obsidian-flavored `obsidianBrainAideTemplate()`).
- **Never overwritten.** After the first write, the file belongs to the user forever. `aide_init` never overwrites, patches or migrates anything under `.aide/config/` on subsequent runs; its brain step reports state only, as markers, flags and sizes.
- **Changes are consented, one decision at a time.** The only package writes to an existing `brain.aide` come from `aide_upgrade`'s brain category, which `/aide:brain config` drives after the user's yes:
  - `aide_upgrade({ category: "brain" })` inserts only missing sections and returns their markers.
  - `brainChange: <marker | "launcher">` previews one change (`before`, `after`, `beforeHash`), read-only.
  - The same call plus that `beforeHash` applies that one change, refusing if the bytes changed at all since the preview.

  A section is offered for migration only when its text matches a known earlier template version, so sections the user edited and custom launchers are never offered. No call ever rewrites, reorders or reformats a section outside the one change applied.
- **Boundary is the path.** The install/upgrade tooling reads the directory path itself as the ownership signal — there is no per-file allowlist. Any file the user puts under `.aide/config/` is safe from the package's install/upgrade machinery.

Files outside `.aide/config/` (the methodology docs at `.aide/docs/`, pipeline command templates, agent definitions, skills, every other artifact the package ships) are package-owned and re-installed on every init/upgrade.

`brain.aide` is the current inhabitant of `.aide/config/`; the convention is forward-compatible with future user-owned config files.

## Launch modes

Each MCP server entry — the `aide` server and the brain server declared in `mcpServerConfig` — launches in one of two modes. Setup asks which one, recommends global, and never switches an existing entry.

- **Global** — pick it on a personal machine. Install once with `npm i -g @aidemd-mcp/server`; the entry runs the installed command by name, and terminal commands are `aidemd-mcp init` and `aidemd-mcp sync`. It stays on the installed version until you reinstall. Global is the fast launcher and the only one that works offline.
- **Local** — pick it for shared repos and cloud/CI. The entry runs through npx, pinned to one exact version: `npx -y @aidemd-mcp/server@<version> sync`. `/aide:upgrade` moves the aide pin forward when you confirm it. Its first launch after a pin change downloads the package, and even a pinned, cached start still contacts the registry, so an npx cold start can miss Claude Code's 30-second connect window.

The brain server's global or local launcher lives in `mcpServerConfig`, and a local brain launcher is pinned the same way. `/aide:brain config` sets the launcher, offers the global install of the brain's own package, and moves the brain pin forward with your OK. A legacy brain launcher is updated through the brain category's `brainChange: "launcher"` preview and apply, which keeps the current launch mode.

## Lifecycle

1. **Created or repaired** by `/aide:brain config`. When `.aide/config/brain.aide` is missing, the command asks which backend the user wants. For the bundled Obsidian default it uses the template `aide_init` returns, which carries YAML null at the unwired launcher slot until step 2 (a cold `cli/init` install also scaffolds that template once, if the file is absent). For any other backend it hands off to the `aide-brain-author` skill, which writes the launcher and every section with the user, section by section, from the contract listing and each section's template text and `purpose` (`aide_brain` with `source: "contract"` and `source: "template"`), checks the draft with `source: "draft"`, then swaps it in or leaves it beside an existing config. When the file exists but is outdated, the command repairs it as described under `### Body shape`. Either way the result is validated with the real parser through `aide_info`; a hand-written file counts only if the parser accepts it.

2. **Filled** by the user via `/aide:brain config`. The config section's prose runs, asks the user for whatever values the YAML-null slots need (e.g. the brain root path for the bundled Obsidian default), and edits `brain.aide` to land the resolved values into the args slots. Retargeting, switching brains, swapping the MCP launcher and rewriting any body section are also edits to this one file.

3. **Propagated** to `.mcp.json` by sync (`aidemd-mcp sync` for a global install, `npx -y @aidemd-mcp/server@<version> sync` for a local one — match the project's `aide` entry). The user runs this after the slot-filling step. Sync reads the frontmatter, expands any `${...}` interpolations in `mcpServerConfig.args` (the default scaffold has none), and writes the resulting object into `.mcp.json` under the fixed `brain` key. Sync refuses null-bearing args: if any element of `mcpServerConfig.args` is still null, sync exits non-zero and routes the user back to `/aide:brain config`. Sync is the only mechanism that mutates `.mcp.json`'s brain entry.

4. **Seeds written** by the integration's `aide-config` prose, after sync passes. For each seed missing from the brain, the prose fetches that section with `aide_brain({ kind: <marker> })` and writes it into the brain via the brain's own MCP write tool at the contract `seedPath`, skipping any file that already exists. The section's empty lines at its start and end are dropped, and a leading frontmatter block is passed in whatever form the backend's write tool expects (for example as a separate frontmatter argument) rather than left inside the body. The presence-check + re-seed loop owns missing-artifact recovery on every `/aide:brain config` invocation. The kanban board, the kanban index and the operation guides are seeded here like any other seed section.

5. **Restart Claude Code** so the new MCP server loads. MCP server registration is read at client startup; an edit + sync without a restart leaves the running session pointing at the previous brain.

6. **Drift detected** by the boot reporter. At session start, the reporter compares the `brain` entry in `.mcp.json` against the values declared in `brain.aide`. If they disagree, the reporter surfaces `mcp-drift`. The orchestrator treats drift as a hard halt: it does not proceed, does not attempt self-repair, and directs the user to run sync (`aidemd-mcp sync` for a global install, `npx -y @aidemd-mcp/server@<version> sync` for a local one — match the project's `aide` entry).

Re-running sync against an unchanged `brain.aide` is idempotent — it reads the file, computes the same target object, sees `.mcp.json` already matches, and exits reporting no change.

## Boot reporter brain status states

The boot reporter surfaces exactly five brain status states. The orchestrator reads the state and decides whether the pipeline can advance.

- **`ok`** — `.aide/config/brain.aide` exists and satisfies the contract, `.mcp.json` has a `brain` entry, and the two agree. The pipeline proceeds.

- **`no-brain-aide`** — `.aide/config/brain.aide` is absent (ENOENT), and only that. A file that is present is never reported as absent; a present file that cannot be read (permissions, a directory at the path) is `brain-aide-invalid` with a reason naming the read error. Remediation: run `/aide:brain config`, which asks which backend to use and creates the file. The orchestrator halts until the file is in place.

- **`brain-aide-invalid`** — the file is present but falls short of the contract. The state carries a `fault`: `missing-sections` with the absent `sections` (a file written against an earlier contract, or one missing a block), or `malformed` with the parser's `reason` (unusable frontmatter, or a structural fault among the marker pairs). Remediation: run `/aide:brain config`, which inserts the missing sections after confirmation, or shows the reason for hand repair. The orchestrator halts until the file is valid.

- **`no-mcp-entry`** — `brain.aide` exists, but `.mcp.json` has no `brain` entry under `mcpServers`, OR `mcpServerConfig.args` carries one or more YAML null entries (a null-bearing config is by definition not a wireable launch command, so it collapses semantically into `no-mcp-entry`). Remediation: run `/aide:brain config` to fill any null slots, then run sync (`aidemd-mcp sync` for a global install, `npx -y @aidemd-mcp/server@<version> sync` for a local one — match the project's `aide` entry) to write the entry from the source of truth, then restart Claude Code. The orchestrator halts until the wiring is in place.

- **`mcp-drift`** — both `brain.aide` and the `.mcp.json` `brain` entry exist, but their values disagree (the `command` differs, the `args` differ, or the user hand-edited `.mcp.json` away from what `brain.aide` declares). Remediation: run sync (`aidemd-mcp sync` for a global install, `npx -y @aidemd-mcp/server@<version> sync` for a local one — match the project's `aide` entry) to bring `.mcp.json` back in line with the source of truth, then restart Claude Code. The orchestrator halts until the two agree. The boot reporter never auto-repairs drift — auto-repair would shift a load-bearing contract surface out from under the user and erase any deliberate hand-edit they made.

## Divergence from intent specs

`brain.aide` shares its file extension with the intent-spec family but is not an intent spec. The following fields the intent-spec template requires are explicitly absent:

- **No `scope`** — `brain.aide` has no scope boundary. It is a project-wide config file; scoping it to a subdirectory has no meaning.
- **No `intent` paragraph** — `brain.aide` does not describe desired behavior for an agent to implement. It is runtime configuration, not an engineering contract.
- **No `outcomes` block** — there are no desired or undesired outcomes to specify. The file's "outcome" is simply that the brain is correctly wired; correctness is verified by the boot reporter, not by an outcomes list.
- **No `description` field** — intent specs use `description` to name what the module does; `brain.aide` uses `name` to label the brain type, which is descriptive metadata, not a description of what code does.
- **No `status` lifecycle field** — intent specs track `draft`, `aligned`, `in-progress`, `done`; `brain.aide` has no lifecycle phases of that kind. It is always "the current config."

**Rationale.** Brain configuration is runtime configuration; intent specs are engineering contracts. Conflating the two erodes the methodology's central distinction — every downstream agent that reads both types would have to decide which rules apply. The absence of intent-spec fields from `brain.aide` is a hard boundary, not an oversight.

## Rules

- **All body sections returned verbatim.** `aide_brain` returns any requested section, live or seed, byte-identical to disk. No server-side templating, no rendering pass, no variable substitution applies to any body section.

- **One decision's worth of bytes at a time.** The install summary carries no section text. `aide_brain` returns one section per call, and `aide_upgrade`'s brain preview returns one before/after. No package code path writes a seed into the brain; the agent does, through the brain's own MCP write tool.

- **`aide_brain` is read-only.** It never writes, and its `purpose` comes only from the published contract. The sync verb and boot reporter read frontmatter only for wiring.

- **The section list has one source.** The required sections live in the server's published contract and nowhere else. This doc, the templates' prose and agent prompts point to it and never restate it.

- **`mcpServerConfig.args` interpolation runs only at sync time.** Any `${fieldName}` references in `args` are expanded by sync (`aidemd-mcp sync` for a global install, `npx -y @aidemd-mcp/server@<version> sync` for a local one — match the project's `aide` entry) against the frontmatter and written into `.mcp.json`. They are never expanded at read time, at server startup, or inside any body section.

- **The brain's interface contract is the `orientation` section, not the schema.** The frontmatter does not declare expected MCP tool names, expected operations, or expected entry-point paths. The agent reads the `orientation` section verbatim, calls whatever MCP tools it names, and surfaces failures fast. A frontmatter field whose only consumer is the parser's own validation is rejected.

- **`name` is descriptive metadata, never dispatched on.** No code in this package branches on the value of `name`. The field exists so a human reading the file immediately knows what kind of brain is wired and so the agent can narrate its connection in conversation. Introducing any code path that switches on `name` re-introduces the in-code backend registry this architecture rejects.

- **Adding a new brain is a host-side edit + sync, never a code change to this package.** The package has no opinion about which brain a host runs — only about how the host declares it. A new brain = write a `brain.aide` that satisfies the contract (`/aide:brain config` can author it), run sync (`aidemd-mcp sync` for a global install, `npx -y @aidemd-mcp/server@<version> sync` for a local one — match the project's `aide` entry), restart Claude Code.

- **Drift is a hard halt.** When the boot reporter surfaces `mcp-drift`, the orchestrator stops. It does not auto-repair. It directs the user to run sync.

- **The `.mcp.json` brain key is fixed.** Sync always writes to `mcpServers["brain"]`. The key name is not configurable; downstream tooling, the boot reporter, and the orchestrator all read from the same fixed name.

- **`.aide/config/` is user-owned forever.** `aide_init` never writes under `.aide/config/` after the first scaffold. New contract sections and migrations reach an existing host only through `/aide:brain config`, which the user runs; it applies each one through `aide_upgrade`'s brain category, after the user confirms.

- **One file, one source of truth.** `brain.aide` is the single source of truth for brain configuration. The host's `.mcp.json` brain entry is a derived artifact — it must match `brain.aide` and is only updated by sync.

- **Outdated is reported, never silently accepted.** A present file short of the contract surfaces as `brain-aide-invalid`. Repair is `/aide:brain config` inserting only the missing sections; there is no transitional read path, no auto-injection and no heading-based guessing. Outdated section text and a legacy launcher are reported by `aide_info` as `brainMigration` (a soft notice, never a gate) and migrated only through `/aide:brain config`, one previewed and confirmed change at a time.

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
