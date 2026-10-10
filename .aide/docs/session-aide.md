# session.aide Spec

The pipeline-position log. A single `session.aide` lives at the project root inside `.aide/` and is the in-flight feature's index to the board: it names the current stage, the task in progress, the tasks in work order, the decisions and anti-regression invariants that span those tasks, where the cycle paused, and which task is next. Each task's own progress — what was done, its decisions, remaining work, gotchas — lives in that task's stash, not here.

It replaces the legacy `handoff.aide` pattern: same content, fixed location, integrated into the methodology rather than hand-written ad hoc.

It is **long-lived and never deleted**: created the first time a feature pipeline needs a durable tracker, it survives every build/QA/fix cycle and every feature after it. When a feature closes, the next handoff rewrites it for the work that comes next — the board almost always has a next task.

## Why This Exists

Features sometimes span multiple build/QA/fix cycles, multiple architectural reworks, multiple sessions of conversation. The orchestrator can't hold all of that in any single session's context — context bloats, agents lose the thread, and prior decisions get re-litigated.

`session.aide` is the durable pipeline state. When a fresh orchestrator (or any pipeline agent) reads it at boot, it knows:

- which stage of the pipeline is in flight
- which tasks on the kanban board track the work, in work order
- which decisions spanning those tasks are settled and must not be re-debated
- which anti-regression invariants every build phase must hold
- which task is next — and that task's latest stash says exactly where it stands

Without it, every resume costs a full re-orientation. With it, resume is two reads: `session.aide`, then the next task's latest stash.

## Format

```yaml
---
intent: >
  One-line summary of the feature this session is tracking.
---
```

```markdown
# AIDE SESSION

Cold-start protocol for agents reorienting on this project. This is a
snapshot of the current architectural intent and the anti-regression
invariants every build phase must hold. It is NOT historical commentary —
superseded design decisions are cut, not annotated.

## State summary (set <date>, <phase>)

A few lines only: the current stage, the task in progress (by slug), the
commit/publish state, what is blocking. No work history — what was done
lives in the tasks' stashes.

## Kanban

The main section: the feature's tasks on the project's kanban board, in
work order. One line per task tied to the feature, linked by slug (the
stable link; the kanban skill finds the task in whatever column it sits).
The task's stash holds its progress:

- `<task-slug>` (<column>) — <what the task covers>

## The architectural intent (what the specs say after the rewrite)

Numbered list of the architectural decisions that are settled for this
feature and span its tasks. A decision that concerns one task lives in that
task's stash. Each numbered decision is a stable commitment — if the architect,
implementor, or QA encounters a question that touches one of these, the
answer is here, not in conversation. Numbers persist across edits; gaps
remain when a decision is retired so existing references stay stable.

1. **<title>**. <one-paragraph statement of what's settled.>
2. **<title>**. <next decision.>

## Anti-regression invariants future build phases must hold

Imperative rules every build agent must check at every step. These overlap
with the architectural intent above; they are listed here as the build
phase's checklist, not as new content.

- **<rule one>** — phrased as a constraint the build must not violate
- **<rule two>**

## Where this cycle stopped (CRITICAL READING)

The most important section for resume. Names the next task by slug and the
stage it is at, and points the next agent to that task's latest stash for
where the work stands.

### What the next agent must do

A short ordered list of the tasks to work next, each by slug with one line,
plus any feature-level step that has no task (e.g. publish once every task
is done). The next orchestrator reads this and starts from item 1.

## Process discipline (permanent)

Notes about how the pipeline must be run for this feature — pause points,
context discipline, batching rules. Permanent for the feature's lifetime;
not for any single cycle.

## Open questions

Questions awaiting the user that span the feature's tasks. A question about
one task lives in that task.
```

## Rules

- **One file per project, not per module.** `session.aide` lives at `.aide/session.aide` and ONLY there. Per-module pipeline state lives in `brief.aide`, `plan.aide`, and `todo.aide`. This file is the project-wide tracker.
- **Always links the board.** `## Kanban` is required: every task tied to the feature appears by slug with its column, and every item in `## Where this cycle stopped` that has a task names its slug. The `/aide` orchestrator checks the board at boot and reads these links first; a feature with no task gets one through the kanban skill before the file is written.
- **An index, not a copy.** No task detail here. What was done on a task, its task-level decisions, remaining work and gotchas go into that task's stash through the kanban skill; `session.aide` names the task by slug with one line.
- **No follow-up lists.** Follow-up work becomes a task on the board, never a list in `session.aide`.
- **Replaces `handoff.aide`.** Pre-doctrine projects may still have a `.aide/handoff.aide` file — under the new doctrine that file is renamed to `.aide/session.aide` and integrated into the pipeline's resume protocol. Do not maintain both.
- **Numbered architectural decisions are stable references.** When a plan or brief says "see session decision #21," that number must keep meaning the same thing across edits. Removing a decision leaves a gap; new decisions append.
- **No domain reasoning.** Why-the-business-needs-this lives in `.aide/intent.aide` and module specs. `session.aide` is what's true *right now* about the in-flight feature, not why the feature exists.
- **Not cascaded, not aligned, not validated.** The aligner does not walk `session.aide`. `aide_validate` does not warn about it. It is operational state, not durable intent.
- **Implementation contracts welcome — when they span the feature's tasks.** A contract for one task's work lives in that task's stash (or the module's `brief.aide`). Type shapes, exact strings, schema details, marker tokens, slot indexes — anything that helps an agent reorient without re-deriving the architecture from code.
- **Cut superseded decisions.** When a design decision is replaced by a new one, delete the old text. Git history preserves it. The session file describes the *current* state, not the journey.
- **Frontmatter is minimal.** `intent` only. No `scope`, no `outcomes`, no `status`.

## Lifecycle

`session.aide` is authored and updated by the `aide-spec-writer` agent (the structured-file writer that also owns `.aide` frontmatter — both are "format orchestrator-supplied context into a canonical AIDE file" operations). Nothing deletes it — not the `aide-maintainer` agent, not the `aide_cleanup` tool. The orchestrator decides WHEN the file needs to be created or updated, and supplies the content; the spec-writer transcribes the orchestrator's supplied state into the canonical format and writes the file. This preserves the orchestrator's "delegate everything; never write files" constraint while giving each lifecycle stage a clear specialized owner.

1. **Created** by the `aide-spec-writer` agent on orchestrator demand, when a feature pipeline begins and the orchestrator decides the work is large enough to need a durable tracker. Most features do not need one — a single-cycle build never gets one. Multi-cycle reworks, cross-module sweeps, and features paused for user review across multiple sessions DO get one. The orchestrator's delegation prompt supplies the initial content (feature intent, current stage, task links in work order, settled decisions, anti-regression invariants, the next task); the spec-writer formats and writes the file.
2. **Read at boot** by the `/aide` orchestrator on every invocation if the file exists. The orchestrator's resume protocol consults `## Where this cycle stopped` first, then the next task's latest stash, then `## The architectural intent` for the settled-decisions list.
3. **Updated** by the `aide-spec-writer` agent on orchestrator demand at every meaningful pipeline-state transition: when a stage completes, when a stage is paused for user review, when a new architectural decision is settled, when an anti-regression invariant is added. The orchestrator's delegation prompt names what changed and supplies the new content; the spec-writer applies the update — appending decisions at the next stable number, rewriting the `## Where this cycle stopped` section and the `## Kanban` links, cutting superseded prose. The record of finished work goes into the task's stash, not here. The spec-writer never invents content; it transcribes what the orchestrator describes.
4. **Rewritten, never deleted,** when a feature closes. The closing handoff records the finished tasks in `## Kanban` and rewrites `## State summary` and `## Where this cycle stopped` around the next task on the board; decisions and invariants that no longer span live work are cut.

## Placement

`session.aide` lives at:

```
.aide/
├── intent.aide       ← project root intent (durable)
├── session.aide      ← pipeline-position log (this file)
└── docs/             ← methodology docs
    └── ...
```

It does NOT live next to module specs. Per-module ephemeral state lives in `brief.aide`, `plan.aide`, and `todo.aide` inside the module folder.

## Distinction from `brief.aide`

| | `brief.aide` | `session.aide` |
|---|---|---|
| Scope | Per module | Project-wide (one file at root) |
| Content | Implementation contracts for one module | Pipeline state across the whole feature |
| Lifespan | Per feature (removed post-QA) | Long-lived; never deleted, rewritten as features close |
| Owner | Strategist creates; architect + implementor update | `aide-spec-writer` creates and updates (orchestrator supplies the content) |
| Resume target | The architect picking up plan revision | The orchestrator picking up the whole pipeline |

A `brief.aide` answers "what shape must the code in *this module* take?" `session.aide` answers "where does the pipeline stand on *this feature*?" Both are operational state; neither is durable intent.

## Distinction from `.aide/intent.aide`

| | `.aide/intent.aide` | `.aide/session.aide` |
|---|---|---|
| Lifespan | Durable; survives across all features | Long-lived, but its content is operational state, rewritten as features close |
| Bound by Brevity Contract? | Yes | No |
| Cascades to children? | Yes — root of the intent tree | No |
| Survives a rewrite? | Yes — durable contract | No — describes work in flight |

`.aide/intent.aide` is *what the project does at the highest level*. `.aide/session.aide` is *what the pipeline is currently doing about it*. They sit side by side in the same folder for a reason — together they tell an arriving agent everything about the project AND the work in flight, in two short reads.
