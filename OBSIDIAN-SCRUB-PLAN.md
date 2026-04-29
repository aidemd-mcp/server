# Obsidian Terminology Scrub — Plan

A final pass to remove Obsidian-specific prose from methodology docs, commands, agents, and skills. After this pass, AIDE agents should not assume any specific backend (Obsidian, openbrain, Notion, etc.) — the only path to backend specifics is calling `aide_brain` to get instructions for the wired backend.

---

## Scope

- `.aide/docs/**/*.md` — methodology docs that ship with the install
- `.claude/commands/**/*.md` — slash command prompts
- `.claude/agents/**/*.md` — agent definitions
- `.claude/skills/**/*.md` — skill prompts

Out of scope (historical pipeline artifacts, not user-facing):
- `.aide/docs/.aide`, `.aide/docs/plan.aide`
- `.claude/.aide`, `.claude/plan.aide`

---

## Files with Offending Terminology

### Methodology docs (`.aide/docs/`)

| File | Line(s) | Offender |
|------|---------|----------|
| `index.md` | 37 | "playbook hub" |
| `aide-spec.md` | 183 | "brain notes" in the handoff list |
| `aide-template.md` | 98 | "brain note path" |
| `plan-aide.md` | 105 | "playbook notes" |
| `brain-aide.md` | 106 | "canonical Obsidian default" (mild — it's documenting install reality) |

### Commands (`.claude/commands/`)

| File | Line(s) | Offender |
|------|---------|----------|
| `aide.md` | 224 | "Search web, vault, MCP memory" |
| `aide.md` | 236, 348, 352 | "brain notes" |
| `aide.md` | 264 | "playbook notes" |
| `aide/research.md` | 12 | "vault notes" |
| `aide/synthesize.md` | 10, 13 | "research notes" (generic-ish but leans markdown) |
| `aide/update-playbook.md` | 5, 10, 13 | "playbook hub" |
| `aide/brain.md` | many | heavy "vault" usage throughout — **special case, see decisions below** |

### Agents (`.claude/agents/aide/`)

| File | Line(s) | Offender |
|------|---------|----------|
| `aide-architect.md` | 39 | "playbook notes" |
| `aide-auditor.md` | 31 | "hub → section hub → content notes → wikilinks" |
| `aide-domain-expert.md` | 25, 30, 53, 67, 83, 84 | vault, `[[wikilinks]]`, "the vault's power is in its connections", "Vault locations", "vault-sufficient" |
| `aide-strategist.md` | 11, 29, 39, 48 | "brain notes" (repeated) |

### Skills (`.claude/skills/`)

| File | Line(s) | Offender |
|------|---------|----------|
| `brain/SKILL.md` | 8, 48 | "shared notes" |
| `brain/SKILL.md` | 66 | "MCP memory" — generic, leave alone |
| `study-playbook/SKILL.md` | — | not yet read; will check on execution |

---

## Substitution Glossary

| Obsidian-flavored | Backend-agnostic replacement |
|---|---|
| vault | brain |
| brain note / vault note / research note | brain entry / research entry (or just "research") |
| `[[wikilinks]]` | cross-references |
| playbook hub / section hub / hub note | playbook entry-point / section root |
| "the vault's power is in its connections" | "the brain's power is in its connections" |
| "follow `[[wikilinks]]`" | "follow the cross-references the brain exposes" |

---

## What I'll Leave Alone (Not Obsidian-Specific)

- `frontmatter` — generic YAML/markdown term
- `MCP memory` — generic MCP concept (multiple servers expose memory tools)
- "Doc Hub" in `index.md:1` — refers to the literal `.aide/docs/index.md` markdown file in this repo, not a brain hub
- "PASS WITH NOTES", "note them separately", "noted in" — generic English usage of "note"
- `name: obsidian` example in `brain-aide.md:11` — legitimate example content; the doc is teaching the schema by showing a concrete backend
- `.claude/.aide` and `.claude/plan.aide` — historical pipeline artifacts

---

## Two Decisions Needed Before I Execute

### Decision 1 — `.claude/commands/aide/brain.md`

This is the brain-wiring config command. It currently asks **"Where is your brain vault?"** and uses `vault` heavily because the default scaffold is Obsidian.

Three options:

- **(a)** Generalize all wording (e.g. `"Where is your brain stored?"`) but keep Obsidian as the default scaffold backend.
- **(b)** Leave it as-is — argue that the config command is the *one* place backend-aware wording is OK because it's literally wiring a backend.
- **(c)** Make it fully config-driven: read `brain.aide` to know what fields to prompt for. This is a bigger redesign, not a terminology pass.

**My recommendation: (a)** — fits the "agents shouldn't know backend specifics" principle. Even the config command shouldn't *assume* the user is wiring Obsidian; the brain.aide template can carry the backend-specific defaults.

### Decision 2 — `brain-aide.md:106`

The doc says **"pre-filled with the canonical Obsidian default."**

Two options:

- **(a)** Soften to *"pre-filled with a default scaffold"* — keeps the doc backend-neutral.
- **(b)** Leave — it's accurately documenting that the install ships with an Obsidian-flavored default brain.aide.

**My recommendation: (a)** — the doc shouldn't prescribe a backend even if the install currently picks one.

---

## Execution Order

Once decisions are confirmed, I'll edit in this order:

1. Methodology docs (`.aide/docs/`) — they're the most-cited canonical source
2. Agent definitions (`.claude/agents/aide/`) — these are the prompts that actually get loaded
3. Command prompts (`.claude/commands/aide/`)
4. Skills (`.claude/skills/`)

After each batch I'll re-grep the same patterns to confirm zero remaining occurrences before moving to the next batch.
