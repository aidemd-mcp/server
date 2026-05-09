# AIDE Methodology Doc Hub

- [aide-spec.md](./aide-spec.md)
- [aide-template.md](./aide-template.md)
- [plan-aide.md](./plan-aide.md)
- [todo-aide.md](./todo-aide.md)
- [brief-aide.md](./brief-aide.md) — per-module architect's pre-read (deleted post-QA)
- [session-aide.md](./session-aide.md) — root-level pipeline-position log (replaces legacy `handoff.aide`)
- [brain-aide.md](./brain-aide.md)
- [progressive-disclosure.md](./progressive-disclosure.md)
- [agent-readable-code.md](./agent-readable-code.md)
- [automated-qa.md](./automated-qa.md)
- [cascading-alignment.md](./cascading-alignment.md)

## Pipeline Agents

AIDE ships the canonical pipeline agents that `aide_init` installs to `.claude/agents/aide/`. Most map to pipeline phases; the explorer is a read-only investigator:

| Agent | Model | Phase(s) | Brain Access |
|---|---|---|---|
| `aide-spec-writer` | opus | spec | none |
| `aide-domain-expert` | sonnet | research | write |
| `aide-strategist` | opus | synthesize | read |
| `aide-architect` | opus | plan | read (playbook + brain) |
| `aide-implementor` | sonnet | build, fix | read (playbook) |
| `aide-qa` | sonnet | qa | none |
| `aide-aligner` | opus | align | none |
| `aide-auditor` | opus | refactor | read (playbook + brain) |
| `aide-explorer` | sonnet | investigation (read-only) | read |
| `aide-maintainer` | sonnet | post-QA cleanup | read (brain — verifies retro promotion) |

The orchestrator (`/aide`) delegates to these agents by name. Each agent gets fresh context per phase — handoff is via files (`.aide`, `plan.aide`, `todo.aide`), not conversation. The explorer is the exception: it is a non-pipeline agent used for bug tracing, codebase questions, and intent-tree navigation — it never writes files. The maintainer is a precondition-gated cleanup pass: it runs once per closed feature (delegated by the orchestrator after QA passes and the retro is promoted to brain) to delete the per-module ephemerals (`brief.aide`, `plan.aide`, `todo.aide`) and, when the last in-flight feature closes, the project-wide `.aide/session.aide`.

## Skills

AIDE ships two canonical skills that `aide_init` installs to `.claude/skills/`:

| Skill | Purpose |
|---|---|
| `study-playbook` | Navigate the coding playbook top-down to load conventions before writing or reviewing code |
| `brain` | Signpost — tells agents when a task needs cross-project knowledge external to the repo, and routes them through `/aide:brain` |

The `aide-architect` and `aide-auditor` agents declare `study-playbook` in their frontmatter to load conventions before planning. Host teams build their own coding playbook inside the brain — an external, team-shareable knowledge store that the `brain` skill points at and the `/aide:brain` command navigates.
