---
name: aide-handoff
description: >
  Record current pipeline state to `.aide/session.aide` — the
  project-wide pipeline-position log that lets the next session (yours
  or another agent's) resume from a known point. CREATE on first
  invocation per feature; UPDATE on every subsequent meaningful
  transition. This skill is the orchestration layer: it detects
  CREATE vs UPDATE from file state, gathers content from the invoking
  agent's conversation context, and delegates the actual write to the
  `aide-spec-writer` agent in `session.aide` mode. Invoke this skill
  when the user types `/aide:handoff`, asks to "save the session" or
  "record where we are", or whenever a multi-cycle feature reaches a
  state transition the next agent must not re-derive from scratch —
  stage completed, architectural decision settled, anti-regression
  invariant added, pipeline paused mid-review. Do NOT invoke for
  single-cycle builds or trivial fixes — those resume from
  conversation context alone and a handoff would be noise.
  `session.aide` is never deleted — when a feature closes, UPDATE it
  for the next task.
---

# /aide:handoff — Session Handoff

Record current pipeline state to `.aide/session.aide`. This skill owns the orchestration; the `aide-spec-writer` agent owns the actual file write (it transcribes orchestrator-supplied state into the canonical format). Nothing deletes `session.aide`; it is long-lived and rewritten as features close. See [session.aide spec](../../../.aide/docs/session-aide.md) for the file format.

## Hard constraints

- **You do NOT write `.aide/session.aide` yourself.** The actual file write belongs to `aide-spec-writer`. This skill describes the orchestration that surrounds the delegation.
- **You do NOT invent content.** The invoking agent (orchestrator or other) holds the conversation context — current stage, settled decisions, where work paused, anti-regression invariants. That context is the content source. If the conversation doesn't supply it, ask before invoking the skill — never fabricate state.
- **You do NOT delete `.aide/session.aide`.** Nothing does. This skill is exclusively for create/update.

## Checklist

- [ ] **Detect operation mode.** Read whether `.aide/session.aide` exists:
  - File missing → **CREATE** mode (first handoff for the in-flight feature)
  - File exists → **UPDATE** mode (apply a surgical diff to the existing log)
- [ ] **Gather content from conversation context.** Before delegating, identify the specific pieces `aide-spec-writer` needs:
  - **For CREATE:** feature intent (one line for the frontmatter `intent:` field); state summary (a few lines: current stage, the task in progress, commit/publish state, what's blocking); `## Kanban` task links (one line per task tied to the feature, in work order: slug, column, what it covers); `## Where this cycle stopped` content (the next task by slug and its stage, then the ordered list of tasks after it); architectural decisions that span the feature's tasks (numbered list, if any); anti-regression invariants (bullet list, if any); process discipline notes (optional); open questions awaiting the user (optional)
  - **For UPDATE:** change description (what transition occurred); section-targeted edits (e.g. "append decision #4: ...", "rewrite `## Where this cycle stopped` to: ..."); numbered references to preserve (decision #N stays stable across edits). Whenever a task was created, moved, finished, or newly tied to the feature, include the matching `## Kanban` edit — and if the existing file has no `## Kanban` section, add one.
- [ ] **Keep it an index, not a copy of the tasks.** `session.aide` points at the board; each task's stash holds that task's progress — what was done, its decisions, remaining work, gotchas. Stash that detail into the task through the `kanban` skill, and give the handoff only the slug and a one-line summary. Follow-up work becomes a task, not a list in `session.aide`.
- [ ] **Task links are mandatory.** `session.aide` always points at the board. If the conversation names no task for the feature, check the board through the `kanban` skill; if no task exists, ask the user to create one there before delegating. Never write a handoff without task links. The slug is the stable link — the kanban skill finds the task by slug in whatever column it sits.
- [ ] **Delegate to `aide-spec-writer`** via the Agent tool (`subagent_type: aide-spec-writer`). The delegation prompt MUST:
  - **Name the operation type explicitly** — `session.aide CREATE` or `session.aide UPDATE`. The spec-writer's default operation is `.aide` frontmatter; naming the operation is mandatory for correct dispatch.
  - **Quote all supplied content verbatim** — the spec-writer transcribes; it never invents.
- [ ] **Receive the verdict** — CREATED, UPDATED, or REFUSED.
  - **REFUSED on `session.aide already exists`** → the orchestrator should have called UPDATE. Switch the operation type and re-delegate.
  - **REFUSED on `session.aide missing`** → the orchestrator should have called CREATE. Switch and re-delegate.
  - **REFUSED on ambiguous prompt or missing load-bearing content** (feature intent, `## Kanban` task links, `## Where this cycle stopped`) → gather the missing content from conversation context (or ask the user if it's not in context) and re-delegate.
- [ ] **Confirm completion** and continue with whatever pipeline work was in flight before the handoff was invoked.

## What this skill does NOT do

- It does not interview the user. The invoking agent holds the conversation context; this skill only formats it into a delegation prompt for `aide-spec-writer`.
- It does not apply the Brevity Contract. `session.aide` is operational state, not durable intent — no caps on description, no word counts, no forbidden-content rules from the `.aide` body. The Brevity Contract is `.aide`-only.
- It does not delete `session.aide`. Nothing does — at feature close, UPDATE it for the next task.
- It does not bypass `aide-spec-writer`. The skill is the orchestration layer; the agent owns the file write. Calling `Write`/`Edit` on `.aide/session.aide` directly from this skill violates the delegation pattern.
