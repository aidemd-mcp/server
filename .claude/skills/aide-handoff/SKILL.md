---
name: aide-handoff
description: >
  Record current pipeline state to `.aide/session.aide` — the
  project-wide pipeline-position log that lets the next session (yours
  or another agent's) resume from a known point. The file always
  exists, starting as an empty placeholder; every handoff is an
  UPDATE that writes whatever the agent has, with or without a task.
  `session.aide` is always kept up to date as the agent works. This
  skill is the orchestration layer: it gathers content from the
  invoking agent's conversation context and delegates the actual
  write to the `aide-spec-writer` agent in `session.aide` mode.
  Invoke this skill when the user types `/aide:handoff`, asks to "save
  the session" or "record where we are", and whenever anything changes
  what `session.aide` says — a stage starts or completes, a decision
  is settled, an invariant is added, a task moves, a release ships, or
  work outside the pipeline changes the state or the next step. Never
  end a turn or a session with `session.aide` behind. `session.aide`
  is never deleted — when a feature closes, UPDATE it for the next
  task.
---

# /aide:handoff — Session Handoff

Record current pipeline state to `.aide/session.aide`. This skill owns the orchestration; the `aide-spec-writer` agent owns the actual file write (it transcribes orchestrator-supplied state into the canonical format). Nothing deletes `session.aide`; it is long-lived and rewritten as features close. See [session.aide spec](../../../.aide/docs/session-aide.md) for the file format.

## Hard constraints

- **You do NOT write `.aide/session.aide` yourself.** The actual file write belongs to `aide-spec-writer`. This skill describes the orchestration that surrounds the delegation.
- **You do NOT invent content.** The invoking agent (orchestrator or other) holds the conversation context — current stage, settled decisions, where work paused, anti-regression invariants. That context is the content source. Write what it supplies; leave the rest empty — never fabricate state, and never hold the write back for content you don't have.
- **You do NOT delete `.aide/session.aide`.** Nothing does. This skill is exclusively for create/update.

## Checklist

- [ ] **Make sure the file exists.** It always should — `aide_init` and the `/aide` boot create the empty placeholder with `aide_scaffold type=session`. If `.aide/session.aide` is missing anyway, call `aide_scaffold({ directory: ".", type: "session" })` first — the placeholder's single source; it never overwrites. Then continue.
- [ ] **Gather content from conversation context.** Every handoff is an UPDATE. Supply whatever you have, section by section:
  - the change description (what happened)
  - section-targeted edits, e.g. "fill the intent with: ...", "append decision #4: ...", "rewrite `## Where this cycle stopped` to: ..."
  - numbered references to preserve (decision #N stays stable across edits)
  - when a task was created, moved, finished, or newly tied to the work, the matching `## Kanban` edit

  The first handoff after the placeholder fills in whatever is known: the one-line intent, the state summary, where the cycle stopped and the next steps, what is done, decisions, invariants, open questions. A missing piece is not a reason to wait. Write what you have now; empty sections stay empty until there is something true to put in them.
- [ ] **Keep it the full session record.** `session.aide` holds what was done, every decision, what is validated and what comes next, in full. A fresh agent reading only this file must know where everything stands. Stashing into the task through the `kanban` skill still happens alongside, but never in place of the detail here.
- [ ] **Link tasks when there are tasks.** Every task tied to the work goes into `## Kanban` by slug, column and what it covers. The slug is the stable link — the kanban skill finds the task by slug in whatever column it sits. Work with no task is still recorded: never hold a handoff back until a task exists. If it is trackable work, ask the user whether to create a task for it, and link it once it exists.
- [ ] **Delegate to `aide-spec-writer`** via the Agent tool (`subagent_type: aide-spec-writer`). The delegation prompt MUST:
  - **Name the operation type explicitly** — `session.aide UPDATE`. The spec-writer's default operation is `.aide` frontmatter; naming the operation is mandatory for correct dispatch.
  - **Quote all supplied content verbatim** — the spec-writer transcribes; it never invents.
- [ ] **Receive the verdict** — UPDATED. A REFUSED only means the prompt was ambiguous about which section an edit belongs to; clarify and re-delegate.
- [ ] **Confirm completion** and continue with whatever pipeline work was in flight before the handoff was invoked.

## What this skill does NOT do

- It does not interview the user. The invoking agent holds the conversation context; this skill only formats it into a delegation prompt for `aide-spec-writer`.
- It does not apply the Brevity Contract. `session.aide` is operational state, not durable intent — no caps on description, no word counts, no forbidden-content rules from the `.aide` body. The Brevity Contract is `.aide`-only.
- It does not delete `session.aide`. Nothing does — at feature close, UPDATE it for the next task.
- It does not bypass `aide-spec-writer`. The skill is the orchestration layer; the agent owns the file write. Calling `Write`/`Edit` on `.aide/session.aide` directly from this skill violates the delegation pattern.
