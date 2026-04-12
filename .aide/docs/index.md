# AIDE Methodology Doc Hub

- [aide-spec.md](./aide-spec.md)
- [aide-template.md](./aide-template.md)
- [plan-aide.md](./plan-aide.md)
- [todo-aide.md](./todo-aide.md)
- [progressive-disclosure.md](./progressive-disclosure.md)
- [agent-readable-code.md](./agent-readable-code.md)
- [automated-qa.md](./automated-qa.md)

## Pipeline Agents

AIDE ships six canonical agents that `aide_init` installs to `.claude/agents/aide/`. Each agent maps to one pipeline role:

| Agent | Model | Phase(s) | Brain Access |
|---|---|---|---|
| `aide-spec-writer` | opus | spec | none |
| `aide-researcher` | sonnet | research | write |
| `aide-domain-expert` | opus | synthesize | read |
| `aide-architect` | opus | plan | read (playbook) |
| `aide-implementor` | sonnet | build, fix | none |
| `aide-qa` | sonnet | qa | none |

The orchestrator (`/aide`) delegates to these agents by name. Each agent gets fresh context per phase — handoff is via files (`.aide`, `plan.aide`, `todo.aide`), not conversation.

## Skills

AIDE ships one canonical skill that `aide_init` installs to `.claude/skills/`:

| Skill | Purpose |
|---|---|
| `study-playbook` | Navigate the coding playbook hub top-down to load conventions before writing or reviewing code |

The `aide-architect` agent declares this skill in its frontmatter. Host projects build their own coding playbook in their Obsidian vault; the skill teaches the navigation pattern.
