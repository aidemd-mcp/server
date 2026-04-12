# Automated QA

The verification loop of [AIDE](./aide-spec.md). Spec documents define what correct output looks like — automated QA uses agents to verify that the system's actual output matches those specs, then iteratively fixes drift without human review of every line.

This completes the AIDE cycle: research → spec → plan → implementation → **QA against specs → fix → re-verify**.

## Why This Exists

When an LLM generates prose, emails, reports, or any output governed by a strategy doc, the output drifts from the spec. Prompt changes fix one issue and introduce another. Manual review doesn't scale — you'd need to re-read the strategy and cross-check every line of output after every change.

Automated QA turns the `.aide` specs into a machine-readable rubric. The same specs that drove implementation now drive verification.

## The Two-Phase Pattern

### Phase 1: QA Agent

The QA agent reads the `.aide` specs and the latest generated output, then produces a checklist of issues — each a discrete finding with a file path, line reference, and the spec rule it violates.

**Inputs:**

1. **`.aide` specs** — the spec files that define what correct output looks like
2. **Generated output** — the actual files the system produced
3. **Judgement directive** — "use judgement; if it sounds wrong, flag it"

**Output:** a `todo.aide` re-alignment document in the module. See [todo.aide spec](./todo-aide.md) for the full format. Each issue references the spec rule violated, the exact location of the problem, and the pipeline stage where intent was lost.

```yaml
---
intent: >
  Which outcome(s) are violated — the gap between spec and reality.
misalignment:
  - implementation-drift
  - test-gap
---
```

```markdown
## Issues

- [ ] **<output-path>:<line>** — <What's wrong in one line.>
      Traces to: `outcomes.undesired[1]` | Misalignment: `implementation-drift`
- [ ] **<output-path>:<line>** — <Next issue, same format.>
      Traces to: `outcomes.desired[3]` | Misalignment: `test-gap`

## Retro

What would have caught this earlier? Which stage needs strengthening?
```

**Key constraint:** the QA agent does NOT propose solutions. Solutions bias the implementor toward a specific approach before it reads the spec itself. The checklist says *what's wrong and where* — the implementor, invoked to work the `todo.aide`, decides *how*.

### Phase 2: Implementor in Fix Mode (One Issue Per Session)

The fix loop is not a separate agent — it is the same [implementor](./aide-spec.md#the-agent-pipeline) that executes architect plans, invoked with a narrower scope and a stricter session protocol. One session per unchecked `todo.aide` item, clean context each time. Each session does exactly this:

1. Read the `todo.aide`, find the next unchecked issue
2. Read the relevant `.aide` specs — the actual strategy, not just the issue description
3. Implement the fix
4. Run the generation command to produce fresh output
5. Compare the new output against the previous output for regressions
6. Check off the item in the `todo.aide`

Then a **new implementor session** repeats for the next unchecked item.

### Why One-Per-Session

The fix loop is an invocation discipline, not a separate agent. Each fix modifies prompts, templates, or logic that affects all generated output. A single session fixing five issues in sequence can't reliably regression-test — fix #3 might undo fix #1, and the implementor won't notice because it's holding stale assumptions from thousands of tokens ago. The same implementor that executes architect plans in build mode is perfectly capable of executing a single `todo.aide` item in fix mode; what changes is the scope and the protocol, not the agent.

One-per-session means:
- **Fresh context** — the implementor reads current state, not cached assumptions
- **Clean diffs** — each fix is one change, one before/after comparison
- **Regression isolation** — if output gets worse, you know exactly which fix caused it

## Regression Testing

The implementor must verify its change didn't make things worse.

1. Output lives in timestamped folders
2. Before fixing, the latest folder is the baseline
3. After fixing, run the generation command — a new timestamped folder appears
4. Compare the new folder against the baseline

A **positive effect** means the output more closely matches the AIDE specs. A **regression** means the output moved *further* from what the specs require. The implementor checks both the targeted issue and surrounding output for unintended drift.

## The `todo.aide` as Coordination

The `todo.aide` file is the handoff contract between agent sessions:

1. **Work queue** — unchecked items are pending, checked items are done
2. **Scope boundary** — each agent works exactly one item
3. **Re-alignment tool** — misalignment tags identify where in the pipeline intent was lost
4. **Audit trail** — the completed checklist shows what was found and fixed
5. **Process learning** — the `## Retro` section captures what would have caught issues earlier; the orchestrator promotes retro findings to the brain at `process/retro/` when the fix loop closes

The `todo.aide` lives in the module it audits. When all items are checked off, the QA cycle is complete and retro is promoted to the brain as durable process learning.

## Prerequisites

The pattern requires three things:

1. **`.aide` specs** alongside orchestrator code — the QA agent's source of truth
2. **A CLI command** that generates output into timestamped folders — so agents can trigger generation and compare runs
3. **The `todo.aide` convention** — so the checklist has a predictable location

## When to Use

- **LLM-generated prose** — emails, reports, summaries where tone and strategy compliance matter
- **Prompt engineering iterations** — when tuning prompts, the QA agent catches drift you'd miss reading output manually
- **Any output governed by AIDE specs** — if a spec defines what correct looks like, an agent can verify against it

Don't use this for code correctness — that's what tests are for. Use it when the output is subjective enough that "does this match the spec?" requires reading comprehension, not assertion checks.
