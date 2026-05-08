# session.aide Spec

The pipeline-position log. A single `session.aide` lives at the project root inside `.aide/` and tracks where the in-flight feature stands across the full pipeline — current stage, what's blocked, anti-regression invariants the build must hold, where the cycle paused, and what the next agent must do to pick up.

It replaces the legacy `handoff.aide` pattern: same content, fixed location, integrated into the methodology rather than hand-written ad hoc.

It is **scoped to one feature lifecycle**: created when a feature pipeline begins, survives every build/QA/fix cycle within that feature, deleted only when the feature is fully completed and the pipeline is no longer in use.

## Why This Exists

Features sometimes span multiple build/QA/fix cycles, multiple architectural reworks, multiple sessions of conversation. The orchestrator can't hold all of that in any single session's context — context bloats, agents lose the thread, and prior decisions get re-litigated.

`session.aide` is the durable pipeline state. When a fresh orchestrator (or any pipeline agent) reads it at boot, it knows:

- which stage of the pipeline is in flight
- which architectural decisions have already been settled and must not be re-debated
- which anti-regression invariants every build phase must hold
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

Where the pipeline is right now. What was just done, what was paused, what
is blocking forward motion. One short paragraph per pipeline stage if
multiple are in flight (e.g. Stage 1 frontmatter complete; Stage 3 body
synthesis complete; Stage 4 plan paused mid-review).

## The architectural intent (what the specs say after the rewrite)

Numbered list of the architectural decisions that are settled for this
feature. Each numbered decision is a stable commitment — if the architect,
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
BLOCKED) and the specific revision needed.

### What the next agent must do

Numbered checklist of the immediate next steps. The next orchestrator reads
this and starts execution from item 1.

### What's already done and validated

Bullet list of work that has landed and does not need to be re-done.

### What's left after the rework lands

Bullet list of follow-up items that surface after the current cycle
completes — smoke testing, version bumps, cleanup, brain promotions.

## Process discipline (permanent)

Notes about how the pipeline must be run for this feature — pause points,
context discipline, batching rules. Permanent for the feature's lifetime;
not for any single cycle.

## Open questions

Decisions still in flight that need user input or further investigation
before the pipeline can advance.
```

## Rules

- **One file per project, not per module.** `session.aide` lives at `.aide/session.aide` and ONLY there. Per-module pipeline state lives in `brief.aide`, `plan.aide`, and `todo.aide`. This file is the project-wide tracker.
- **Replaces `handoff.aide`.** Pre-doctrine projects may still have a `.aide/handoff.aide` file — under the new doctrine that file is renamed to `.aide/session.aide` and integrated into the pipeline's resume protocol. Do not maintain both.
- **Numbered architectural decisions are stable references.** When a plan or brief says "see session decision #21," that number must keep meaning the same thing across edits. Removing a decision leaves a gap; new decisions append.
- **No domain reasoning.** Why-the-business-needs-this lives in `.aide/intent.aide` and module specs. `session.aide` is what's true *right now* about the in-flight feature, not why the feature exists.
- **Not cascaded, not aligned, not validated.** The aligner does not walk `session.aide`. `aide_validate` does not warn about it. It is operational state, not durable intent.
- **Implementation contracts welcome.** Type shapes, exact strings, schema details, marker tokens, slot indexes — anything that helps an agent reorient without re-deriving the architecture from code.
- **Cut superseded decisions.** When a design decision is replaced by a new one, delete the old text. Git history preserves it. The session file describes the *current* state, not the journey.
- **Frontmatter is minimal.** `intent` only. No `scope`, no `outcomes`, no `status`.

## Lifecycle

1. **Created** when a feature pipeline begins and the orchestrator (or a senior pipeline agent) decides the work is large enough to need a durable tracker. Most features do not need one — a single-cycle build never gets one. Multi-cycle reworks, cross-module sweeps, and features paused for user review across multiple sessions DO get one.
2. **Read at boot** by the `/aide` orchestrator on every invocation if the file exists. The orchestrator's resume protocol consults `## Where this cycle stopped` first, then `## The architectural intent` for the settled-decisions list.
3. **Updated** by the orchestrator (and senior agents like the architect or strategist on long reworks) at every meaningful pipeline-state transition: when a stage completes, when a stage is paused for user review, when a new architectural decision is settled, when an anti-regression invariant is added.
4. **Deleted** when the feature is fully completed and the pipeline is no longer in use for it. "Fully completed" means: every per-module `todo.aide` resolved, retros promoted to brain, the version bumped and shipped (if applicable), and the user confirms the feature is closed. After deletion, the project returns to its no-feature-in-flight state.

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
| Lifespan | Per feature (deleted post-QA) | Per feature lifecycle (deleted at feature close) |
| Owner | Strategist creates; architect + implementor update | Orchestrator maintains; senior agents may append |
| Resume target | The architect picking up plan revision | The orchestrator picking up the whole pipeline |

A `brief.aide` answers "what shape must the code in *this module* take?" `session.aide` answers "where does the pipeline stand on *this feature*?" Both are operational state; neither is durable intent.

## Distinction from `.aide/intent.aide`

| | `.aide/intent.aide` | `.aide/session.aide` |
|---|---|---|
| Lifespan | Durable; survives across all features | Ephemeral; deleted at feature close |
| Bound by Brevity Contract? | Yes | No |
| Cascades to children? | Yes — root of the intent tree | No |
| Survives a rewrite? | Yes — durable contract | No — describes work in flight |

`.aide/intent.aide` is *what the project does at the highest level*. `.aide/session.aide` is *what the pipeline is currently doing about it*. They sit side by side in the same folder for a reason — together they tell an arriving agent everything about the project AND the work in flight, in two short reads.
