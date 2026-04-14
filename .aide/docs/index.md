# AIDE Methodology Doc Hub

- [aide-spec.md](./aide-spec.md)
- [aide-template.md](./aide-template.md)
- [plan-aide.md](./plan-aide.md)
- [todo-aide.md](./todo-aide.md)
- [progressive-disclosure.md](./progressive-disclosure.md)
- [agent-readable-code.md](./agent-readable-code.md)
- [automated-qa.md](./automated-qa.md)
- [cascading-alignment.md](./cascading-alignment.md)

## Pipeline Agents

AIDE ships nine canonical agents that `aide_init` installs to `.claude/agents/aide/`. Eight map to pipeline phases; one is a read-only investigator:

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

The orchestrator (`/aide`) delegates to these agents by name. Each agent gets fresh context per phase — handoff is via files (`.aide`, `plan.aide`, `todo.aide`), not conversation. The explorer is the exception: it is a non-pipeline agent used for bug tracing, codebase questions, and intent-tree navigation — it never writes files.

## Skills

AIDE ships two canonical skills that `aide_init` installs to `.claude/skills/`:

| Skill | Purpose |
|---|---|
| `study-playbook` | Navigate the coding playbook hub top-down to load conventions before writing or reviewing code |
| `brain` | General-purpose vault access — read the vault CLAUDE.md, follow its navigation rules, fulfill the user's request |

The `aide-architect` and `aide-auditor` agents declare this skill in their frontmatter. Host projects build their own coding playbook in their Obsidian vault; the skill teaches the navigation pattern.
