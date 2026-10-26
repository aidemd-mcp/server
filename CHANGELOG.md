# Changelog

All notable changes to `@aidemd-mcp/server` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

Bullets that change an AIDE file format start with `[migration]` and carry `Detect`, `Migrate` and `Confirm` lines. The `aide-upgrader` agent reads those bullets at the end of every `/aide:upgrade` to bring a project's own files up to date.

## [Unreleased]

## [0.13.0] - 2026-10-26

### Added
- `aide_validate` reports `plan-without-spec`: a `plan.aide` with no intent spec (`.aide` or `intent.aide`) beside it. The fix is to write the folder's spec, never to delete the plan.

### Changed
- No code without a plan, and no plan without an intent spec. `aide_scaffold` refuses to create a `plan.aide` in a folder that holds no intent spec, creating nothing and naming the missing spec; a `research.aide` alone does not count. A project-root plan goes in `.aide/`, beside `.aide/intent.aide`.
- Specs go on any module that gets its own plan, not only on orchestrators: a shared types folder, a shared-helpers folder or a single-file module gets one (frontmatter only is enough); helper folders inside a module still don't. `aide-spec.md`, `plan-aide.md`, the architect, `/aide:plan` and the `/aide` skill say so, and the architect hands back any module it needs that has no spec instead of planning it.
- A spec is orphaned only when its folder and subfolders hold no code: anything but AIDE files, Markdown and dot-files counts, in any language, and dot-folders and build or dependency folders are skipped. The project root intent spec is never orphaned, and whether a plan is present never decides it. `aide_validate` and `aide_discover` share the rule. Before, any spec in a folder without an `index.ts` or `index.js` was flagged.

### Fixed
- The `aide_scaffold` plan template no longer writes a `description:` field, which `plan-aide.md` does not allow.

## [0.12.1] - 2026-10-25

### Added
- Structure gate in the `/aide` pipeline: before any intent spec is written below the project root — in a project with no code yet, or for a module whose folder does not exist and that no approved tree places — the `aide-architect` proposes the project folder tree in a new structure mode, and no spec below the root is written until the user approves it. Structure mode writes no file; the orchestrator records the approved tree in `session.aide`, and later plans must fit inside it. The spec writer no longer picks a folder the tree has not settled.

### Changed
- The `aide-maintainer` agent shows worked `aide_frontmatter` and `aide_cleanup` calls up front, so it no longer calls either tool without `path` first.
- The spec writer and `/aide:spec` leave the filename to `aide_scaffold` instead of choosing it, and `aide-spec.md` now says the spec writer creates the root intent spec with `aide_scaffold` on the first `/aide` run (it had said `aide_init` does).

### Fixed
- `aide_scaffold` wrote the project root intent spec as `.aide/.aide`, which `aide_discover` never reads as the root, so every module's chain of parent specs lost its top. It now always writes `.aide/intent.aide`, for directory `".aide"` or `"."`.
- `aide_scaffold` counted the project's `.aide/` folder as a spec file. With directory `"."`, type `research` or `both` renamed the whole folder to `intent.aide/` (methodology docs, session record and config inside), and type `intent` falsely reported a skip. Every release from 0.3.1 had it. Scaffold now counts only files, and `"."` means the project's `.aide` folder. A project already hit has an `intent.aide/` folder at its root and no `.aide/`; rename the folder back to `.aide/`.
- [migration] The project root intent spec is `.aide/intent.aide`, never `.aide/.aide`.
  - Detect: a project with a `.aide/.aide` file and no `.aide/intent.aide`.
  - Migrate: call `aide_scaffold({ directory: ".aide", type: "intent" })`, which renames the file to `.aide/intent.aide` and keeps its content.
  - Confirm: once, as a batch.

## [0.12.0] - 2026-10-25

### Added
- `aide_frontmatter` tool: reads or changes one governed frontmatter value of an AIDE file and leaves every other byte as it was. It enforces each value's allowed moves and never decides when a value changes.
- `aide_scaffold` type `session`: writes the project's session record at `.aide/session.aide` as an empty placeholder. It is the placeholder's single source.
- `aide-upgrader` agent: run at the end of every `/aide:upgrade`, it finds project files still on an older format from this changelog's `[migration]` entries, suggests values with evidence from checkboxes and git history, and applies only what the user approves.
- `CHANGELOG.md`, installed into every project as `.aide/docs/changelog.md`.
- `aide_discover` shows a plan's or todo list's status inline, e.g. `[plan: approved]`.
- `aide_validate` warns on intent specs whose alignment is missing or not a known value.

### Changed
- [migration] Intent specs record their review state as `alignment` (`unreviewed`, `aligned`, `misaligned`) instead of `status`.
  - Detect: an intent spec (`.aide`, `intent.aide`) whose frontmatter has a top-level `status:` line and no `alignment:` line, or neither.
  - Migrate: with `aide_frontmatter` set `alignment` to the spec's existing `status` value, which renames the field; a spec with neither gets `unreviewed`.
  - Confirm: once, as a batch.
- [migration] Plans, briefs and todo lists record a lifecycle `status`: `proposed` → `approved` → `completed`, or `abandoned`.
  - Detect: a `plan.aide`, `brief.aide` or `todo.aide` whose frontmatter has no top-level `status:` line.
  - Migrate: set `status` with `aide_frontmatter`. Suggest `completed` when every item is checked, `approved` when the work it describes has started (its named files committed since it was written), otherwise `proposed`. A brief takes its plan's value.
  - Confirm: per file, offering the suggestion with its evidence (checkboxes, git history, a `todo.aide` beside it).
- The session record always exists. `aide_init` and the `/aide` boot create it through `aide_scaffold`, and every handoff is an update that writes whatever is known, with or without a task.
- `aide_scaffold` never overwrites an existing file of any type; replacing a file means removing it with `aide_cleanup` first. New intent specs start `unreviewed`, new plans and todo lists `proposed`.
- `aide_cleanup` removes a plan, todo list or brief only when it is `completed` (every item re-checked) or `abandoned`, or has no status and every item checked. Anything still `proposed` or `approved` is refused, and an abandoned plan takes its brief with it.
- Builds start only on an `approved` plan (and brief); the fix loop starts only on an `approved` todo list, which the orchestrator approves itself after triage. QA's fix loop runs without the user and routes each finding by its misalignment tag.
- Editing a spec resets its alignment to `unreviewed`; only the aligner sets `aligned`.
- `aide_discover`'s project map reads only the head of each file.
- `init` runs only when the CLI is invoked; importing its module no longer starts an install.

### Removed
- `aide_cleanup`'s `allowEmptyPlan` option. A plan with no checkboxes that should be removed is marked `abandoned` instead.

### Fixed
- `aide_scaffold` overwrote existing `todo.aide`, `plan.aide`, intent and research files with blank templates.
- A test ran a real `init` in the package's own repo and left an empty `.aide/versions.json` behind, which made every artifact report as outdated there.

## [0.11.1] - 2026-10-10

### Fixed
- `aide_cleanup` removes a fully checked `todo.aide` in a folder with no `plan.aide`, instead of stranding it.

## [0.11.0] - 2026-10-10

### Added
- `aide-brain-author` skill: writes a brain config for any backend, one section at a time with the user.
- `aide_brain` read-only modes: the bundled template, the contract's section list, and a structural check of a config draft.

### Fixed
- The published versions manifest is built from full git history, and the build refuses a shallow clone.

## [0.10.4] - 2026-10-10

### Changed
- `session.aide` is the full session record again, linked to the board, and is kept up to date as the agent works.

## [0.10.3] - 2026-10-10

### Changed
- The `/aide` boot stops and suggests the upgrade when the project is behind.

## [0.10.2] - 2026-10-10

### Changed
- Brain responses are content-free: `aide_init` carries only a brain summary, and sections are read and migrated one at a time.

## [0.10.1] - 2026-10-10

### Changed
- The kanban skill records the project tag once in the instructions file.
- Publishing uses npm trusted publishing only.

## [0.10.0] - 2026-10-10

### Added
- `aide_cleanup` tool: removes a closed module's plan, todo list and brief, with the preconditions enforced in code.
- `kanban-maintainer` board agent and the `kanban` skill; the `/aide` boot checks the board.
- Global install as a first-class launch mode for the `aide` and brain MCP servers.
- Detection of outdated brain config sections and legacy brain launchers.

### Changed
- The kanban board is per-project task folders; the board file seed is gone.
- Synthesize runs when the feature is a pipeline, independent of research.
- The bundled brain template is written for Obsidian, with the kanban guide split into an index and one guide per operation.

## [0.9.0] - 2026-05-21

### Changed
- Session handoff is a dedicated skill; the `/aide:handoff` command is a thin signpost.

## [0.8.0] - 2026-05-21

### Added
- `/aide:handoff` command for `session.aide` writes.

## [0.7.0] - 2026-05-21

### Changed
- `session.aide` writes go through the spec writer; the maintainer only deletes ephemerals.

## [0.6.1] - 2026-05-09

### Fixed
- Install instructions use one canonical npx launcher.

## [0.6.0] - 2026-05-08

### Added
- `aide-maintainer` agent for post-QA cleanup.
- `brief.aide` and `session.aide` methodology docs.
- CI workflow and automatic GitHub Releases.

## [0.5.7] - 2026-05-08

### Changed
- Intent specs default to frontmatter-only navigation stubs, and the strategist became optional.
- The `aide` skill is the source of truth for the orchestrator boot.

## [0.5.4] - 2026-04-28

### Fixed
- Canonical agent verification commands no longer carry a local command prefix.

## [0.5.3] - 2026-04-28

### Changed
- The brain config install was reworked: `init` scaffolds the bundled `brain.aide`, and the methodology prose lost its Obsidian-specific wording.

## [0.5.0] - 2026-04-27

### Added
- `/aide:brain config` and a brain category in `aide_upgrade`.
- A sectioned `brain.aide` schema with installable entry-point seeds.

## [0.4.5] - 2026-04-25

### Changed
- The orchestrator boots sequentially, gated on the brain.

## [0.4.4] - 2026-04-24

### Changed
- Cold-start install through the npx CLI, with runtime recovery.

## [0.4.1] - 2026-04-20

### Added
- `aide_inspect` tool for reading a symbol's documentation and signature.
- `plan.aide` requires a complete Project Structure tree.

## [0.4.0] - 2026-04-19

### Added
- MCP Registry listing.

## [0.3.15] - 2026-04-18

### Added
- `aide_info` boot-time staleness check.
- README badge category in `aide_init` and `aide_upgrade`.
- Publish workflow for npm and the MCP Registry.

## [0.3.9] - 2026-04-17

### Added
- A complete versions manifest generated at build time for every artifact category.

## [0.3.8] - 2026-04-17

### Fixed
- `aide_validate` reports YAML parse errors instead of a misleading missing description.
- Scoped scans no longer report false missing-spec warnings.

## [0.3.5] - 2026-04-15

### Fixed
- Scaffold templates carry frontmatter.

## [0.3.4] - 2026-04-15

### Fixed
- `aide_discover` shows intent descriptions and plan/todo progress.
- The `aide-explorer` agent is installed by `aide_init`.

## [0.3.1] - 2026-04-14

### Added
- First tagged release: the orchestrator boot sequence, the `aide-explorer` agent, the `init` subcommand and the terminal intent-tree explorer.
