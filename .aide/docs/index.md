# AIDE Methodology Doc Hub

- [aide-spec.md](./aide-spec.md)
- [aide-template.md](./aide-template.md)
- [plan-aide.md](./plan-aide.md)
- [todo-aide.md](./todo-aide.md)
- [brief-aide.md](./brief-aide.md) — per-module architect's pre-read (deleted post-QA)
- [session-aide.md](./session-aide.md) — root-level session record — what was done, decisions, what comes next — linked to the kanban board (replaces legacy `handoff.aide`)
- [brain-aide.md](./brain-aide.md)
- [progressive-disclosure.md](./progressive-disclosure.md)
- [agent-readable-code.md](./agent-readable-code.md)
- [automated-qa.md](./automated-qa.md)
- [cascading-alignment.md](./cascading-alignment.md)
- [changelog.md](./changelog.md) — what changed in each release; its `[migration]` entries tell `aide-upgrader` which project files are on an older format

## Pipeline Agents

AIDE ships the canonical pipeline agents that `aide_init` installs to `.claude/agents/aide/`. Most map to pipeline phases; the explorer is a read-only investigator:

| Agent | Model | Phase(s) | Brain Access |
|---|---|---|---|
| `aide-spec-writer` | opus | spec (`.aide` frontmatter); also writes `session.aide` CREATE/UPDATE on orchestrator demand | none |
| `aide-domain-expert` | sonnet | research | write |
| `aide-strategist` | opus | synthesize | read |
| `aide-architect` | opus | structure (proposes the project folder tree before any spec below the root; writes no file), plan | read (playbook + brain) |
| `aide-implementor` | sonnet | build, fix | read (playbook) |
| `aide-qa` | sonnet | qa | none |
| `aide-aligner` | opus | align | none |
| `aide-auditor` | opus | refactor | read (playbook + brain) |
| `aide-explorer` | sonnet | investigation (read-only) | read |
| `aide-maintainer` | sonnet | post-QA cleanup (records each file's closing status through `aide_frontmatter`, then removes per-module ephemerals through `aide_cleanup`) | read (brain — verifies retro promotion) |
| `aide-upgrader` | sonnet | end of every `/aide:upgrade` (brings the project's own files to the current format from the changelog's `[migration]` entries; applies only user-approved changes) | none |

The orchestrator (`/aide`) delegates to these agents by name. Each agent gets fresh context per phase — handoff is via files (`.aide`, `plan.aide`, `todo.aide`), not conversation. The explorer is the exception: it is a non-pipeline agent used for bug tracing, codebase questions, and intent-tree navigation — it never writes files. The upgrader is the other non-phase agent: `/aide:upgrade` runs it last, every time, in REPORT mode to find project files on an older format, then in APPLY mode for the changes the user approved; it never talks to the user and writes only through AIDE tools. The maintainer is a precondition-gated cleanup pass: it runs once per closed feature (delegated by the orchestrator after QA passes and the retro is promoted to brain) to remove the per-module ephemerals (`brief.aide`, `plan.aide`, `todo.aide`) through the `aide_cleanup` MCP tool, which enforces the checkbox preconditions in code. The project-wide `.aide/session.aide` is never deleted. It is authored by `aide-spec-writer` — the same structured-file writer that owns `.aide` frontmatter — invoked when tracked work first starts (CREATE) and kept up to date as the orchestrator works (UPDATE whenever anything changes what it says). The spec-writer transcribes orchestrator-supplied state; it does not interview the user and does not invent content.

`aide_init` also installs one agent outside the pipeline: `kanban-maintainer` (sonnet), at `.claude/agents/kanban/`. It is the board agent — it reads the project's kanban board and tasks and returns a compact report, and carries out board changes the caller has already approved with the user; it never talks to the user. It ships as a pair with the `kanban` skill, which routes every board read and write to it; neither depends on AIDE. The `/aide` orchestrator uses it through the `kanban` skill for board bookkeeping — it has no pipeline phase.

## Skills

AIDE ships six canonical skills that `aide_init` installs to `.claude/skills/`:

| Skill | Purpose |
|---|---|
| `study-playbook` | Navigate the coding playbook top-down to load conventions before writing or reviewing code |
| `brain` | Signpost — tells agents when a task needs cross-project knowledge external to the repo, and routes them through `/aide:brain` |
| `aide` | The pipeline orchestrator behind `/aide` — boot sequence, phase routing, delegation to the pipeline agents |
| `aide-handoff` | Records pipeline state to `.aide/session.aide` by delegating the write to `aide-spec-writer` |
| `kanban` | Works the project's kanban board (create, work, manage, move, complete, stash, review); routes board reads and writes to `kanban-maintainer`. Works in any project, AIDE or not |
| `aide-brain-author` | Writes a brain config for any backend, section by section with the user, from the bundled template and each section's published purpose; `/aide:brain config` hands off to it for any backend other than the bundled default |

The `aide-architect` and `aide-auditor` agents declare `study-playbook` in their frontmatter to load conventions before planning. Host teams build their own coding playbook inside the brain — an external, team-shareable knowledge store that the `brain` skill points at and the `/aide:brain` command navigates.
