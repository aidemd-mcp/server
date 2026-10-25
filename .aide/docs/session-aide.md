# session.aide Spec

The session record. A single `session.aide` lives at the project root inside `.aide/` and tracks the work as it happens: where it stands, what was done and validated, every decision settled along the way, the anti-regression invariants the build must hold, where the cycle paused and what the next agent must do to pick up. It also points at the kanban board: every task tied to the work is linked by slug. The board tracks the tasks; `session.aide` tracks the session — it holds the full picture on its own, so a resume needs no other read.

It replaces the legacy `handoff.aide` pattern: same content, fixed location, integrated into the methodology rather than hand-written ad hoc.

It **always exists and is never deleted**. It starts as an empty placeholder created by `aide_scaffold type=session`: `aide_init` has the agent create it, and the `/aide` boot creates it in any project that lacks it. From then on the agent writes to it as it works, from the first piece of work, whether or not that work has a task. It survives every build/QA/fix cycle and every feature after it. When a feature closes, the next handoff rewrites it for the work that comes next.

## Why This Exists

Features sometimes span multiple build/QA/fix cycles, multiple architectural reworks, multiple sessions of conversation. The orchestrator can't hold all of that in any single session's context — context bloats, agents lose the thread, and prior decisions get re-litigated.

`session.aide` is the durable pipeline state. When a fresh orchestrator (or any pipeline agent) reads it at boot, it knows:

- which stage of the pipeline is in flight, and what was just done
- which tasks on the kanban board track the work, in work order
- which decisions have already been settled and must not be re-debated
- which anti-regression invariants every build phase must hold
- what is already done and validated, so nothing is redone
- exactly where the prior cycle stopped and what the next step is

Without it, every resume costs a full re-orientation. With it, resume is a one-file read.

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

Where the work is right now. What was just done, what was paused, what is
blocking forward motion, and the commit/publish state. One short paragraph
per pipeline stage if multiple are in flight (e.g. Stage 1 frontmatter
complete; Stage 3 body synthesis complete; Stage 4 plan paused mid-review).
Name the task in progress by slug.

## Kanban

The tasks on the project's kanban board that this work touches, in work
order. One line per task, linked by slug (the stable link; the kanban skill
finds the task in whatever column it sits):

- `<task-slug>` (<column>) — <what the task covers>

## The architectural intent (what the specs say after the rewrite)

Numbered list of the decisions settled in this work — every one, whether it
spans several tasks or concerns one. Each numbered decision is a stable commitment — if the architect,
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

The most important section for resume. Names exactly which stage paused,
why, and what the next agent must do. If the pipeline paused mid-review of
N artifacts, list each artifact with its status (READY / NEEDS REVISION /
BLOCKED) and the specific revision needed. Name the task each item belongs
to by slug.

### What the next agent must do

Numbered checklist of the immediate next steps. The next orchestrator reads
this and starts execution from item 1.

### What's already done and validated

Bullet list of work that has landed and does not need to be re-done —
commits, releases, QA verdicts, fixes, environment changes.

### What's left after the current cycle

Bullet list of follow-up items that surface after the current cycle
completes — smoke testing, version bumps, cleanup, brain promotions. Larger
follow-ups also get a task on the board; name its slug here.

## Process discipline (permanent)

Notes about how the work must be run — pause points, context discipline,
batching rules, release steps. Permanent; not for any single cycle.

## Open questions

Decisions still in flight that need user input or further investigation
before the work can advance.
```

## Placeholder

The empty file `aide_scaffold type=session` writes — the placeholder's single source, used by `aide_init` and the `/aide` boot. A test keeps this block byte-identical with scaffold's template. Every section heading is present and every section is empty, so the first write fills in sections instead of inventing the layout:

```markdown
---
intent: >
  Nothing recorded yet.
---

# AIDE SESSION

Cold-start protocol for agents reorienting on this project. This is a
snapshot of the current architectural intent and the anti-regression
invariants every build phase must hold. It is NOT historical commentary —
superseded design decisions are cut, not annotated.

## State summary

## Kanban

## The architectural intent (what the specs say after the rewrite)

## Anti-regression invariants future build phases must hold

## Where this cycle stopped (CRITICAL READING)

### What the next agent must do

### What's already done and validated

### What's left after the current cycle

## Process discipline (permanent)

## Open questions
```

An empty section is valid at any time. A section stays empty until there is something true to put in it.

## Rules

- **Always present.** The file exists in every AIDE project from install on. Nothing waits on a task, a feature or a pipeline stage before writing it; the first piece of work recorded goes straight into it.
- **One file per project, not per module.** `session.aide` lives at `.aide/session.aide` and ONLY there. Per-module pipeline state lives in `brief.aide`, `plan.aide`, and `todo.aide`. This file is the project-wide tracker.
- **Links the board when there is a task.** Every task tied to the work appears in `## Kanban` by slug with its column, and every item in `## Where this cycle stopped` that has a task names its slug. `## Kanban` may be empty: work with no task is still recorded, never held back until a task exists. The `/aide` orchestrator checks the board at boot and reads these links.
- **The full session record, not just an index.** What was done, every decision, what is validated and what comes next live here, in full. Stashing progress into the task through the kanban skill still happens alongside, but `session.aide` never defers to a stash — a fresh agent reading only this file knows where everything stands.
- **Replaces `handoff.aide`.** Pre-doctrine projects may still have a `.aide/handoff.aide` file — under the new doctrine that file is renamed to `.aide/session.aide` and integrated into the pipeline's resume protocol. Do not maintain both.
- **Numbered architectural decisions are stable references.** When a plan or brief says "see session decision #21," that number must keep meaning the same thing across edits. Removing a decision leaves a gap; new decisions append.
- **No domain reasoning.** Why-the-business-needs-this lives in `.aide/intent.aide` and module specs. `session.aide` is what's true *right now* about the work in progress, not why the feature exists.
- **Not cascaded, not aligned, not validated.** The aligner does not walk `session.aide`. `aide_validate` does not warn about it. It is operational state, not durable intent.
- **Implementation contracts welcome.** Type shapes, exact strings, schema details, marker tokens, slot indexes — anything that helps an agent reorient without re-deriving the architecture from code.
- **Cut superseded decisions.** When a design decision is replaced by a new one, delete the old text. Git history preserves it. The session file describes the *current* state, not the journey.
- **Frontmatter is minimal.** `intent` only. No `scope`, no `outcomes`, no `status`.

## Lifecycle

`session.aide` is created empty by `aide_scaffold type=session` and updated by the `aide-spec-writer` agent (the structured-file writer that also owns `.aide` frontmatter — both are "format orchestrator-supplied context into a canonical AIDE file" operations). Nothing deletes it — not the `aide-maintainer` agent, not the `aide_cleanup` tool. The orchestrator decides WHEN the file needs to be updated, and supplies the content; the spec-writer transcribes the orchestrator's supplied state into the canonical format and writes the file. This preserves the orchestrator's "delegate everything; never write files" constraint while giving each lifecycle stage a clear specialized owner.

1. **Created empty** by `aide_scaffold type=session`, which writes the [placeholder](#placeholder) and never overwrites. `aide_init` directs the agent to call it when AIDE is installed; in a project that lacks the file, the `/aide` boot calls it before any other work. Nothing else creates it, and nothing waits for it to be filled.
2. **Read at boot** by the `/aide` orchestrator on every invocation if the file exists. The orchestrator's resume protocol consults `## Where this cycle stopped` first, then `## The architectural intent` for the settled-decisions list. The file alone is enough to resume.
3. **Kept up to date as the agent works.** Every write after the placeholder is an update, the first one included. The `aide-spec-writer` agent updates it on orchestrator demand whenever anything changes what it says, not only at pipeline milestones: a stage starts, completes or pauses for review; a decision is settled or an invariant added; a task is created, moved or finished; a release ships; or work outside the pipeline (a direct prose edit, a fix, a config or environment change) changes the state or the next step. The orchestrator never ends a turn or a session with the file behind. The orchestrator's delegation prompt names what changed and supplies the new content; the spec-writer applies the update — appending decisions at the next stable number, rewriting the `## Where this cycle stopped` section and the `## Kanban` links, moving finished work into `### What's already done and validated`, cutting superseded prose. The spec-writer never invents content and never refuses for missing content; it transcribes what the orchestrator describes and leaves the rest as it is.
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
| Owner | Strategist creates; architect + implementor update | `aide_scaffold` creates the empty placeholder; `aide-spec-writer` updates (orchestrator supplies the content) |
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
