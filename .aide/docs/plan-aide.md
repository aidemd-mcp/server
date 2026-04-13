# plan.aide Spec

The architect's implementation plan. A `plan.aide` lives next to the `.aide` intent spec it implements — same folder, progressive disclosure tells the implementor which intent it serves.

## Format

```yaml
---
intent: >
  One-line summary of what this plan delivers. Mirrors the `.aide` intent
  but scoped to the concrete work this plan covers — enough for the
  implementor to know at a glance what they are building.
---
```

```markdown
## Plan

### 1. Step title — self-contained unit

- [ ] What to do, which files, what contracts

### 2. Coupled step title — requires shared context

- [ ] 2a. First action in the coupled group
- [ ] 2b. Second action that depends on 2a's in-memory state
- [ ] 2c. Third action completing the group

### 3. Another independent step

- [ ] What to do

## Decisions

Architectural choices made during planning: why X over Y, naming rationale,
tradeoffs accepted. The implementor reads this to understand the reasoning
without re-deriving it.
```

## Rules

- **Frontmatter is minimal.** `intent` only. No `status`, no `spec` pointer — the plan lives next to the spec it implements, and progressive disclosure makes the relationship obvious.
- **Every step gets a checkbox.** The implementor checks each box as it completes during `/aide:build`. Unchecked boxes are pending work; checked boxes are done.
- **Steps execute top-to-bottom.** Sequencing is the architect's job. The implementor does not reorder, skip, or add steps. If a step is ambiguous, escalate back to `/aide:plan`. Each numbered step is executed by a fresh implementor agent. Lettered sub-steps within a number share a single agent session.
- **Each numbered step is a unit of delegation.** The orchestrator spawns one fresh implementor agent per numbered step. This means each step must be self-contained: a fresh agent should be able to execute it by reading the plan, the `.aide` spec, and the current code state — without knowing what a prior agent did in-memory. Write steps at a granularity where each one produces a complete, testable change.
- **Lettered sub-steps for coupled work.** When multiple actions are tightly coupled and cannot be executed independently (e.g., creating a helper and immediately wiring it into the caller), group them as lettered sub-steps under a single number: `1a`, `1b`, `1c`. The orchestrator keeps one agent for all sub-steps of a given number. Use this sparingly — most steps should be independent. If you find yourself lettering more than you're numbering, the steps are too granular.
- **No code.** No function bodies, no worked examples, no copy-paste snippets. Steps describe decisions — file names, contracts, sequencing, reuse. The implementor writes the code.
- **Every step traces to intent.** Each step must be traceable back to a line in the `.aide` spec, a rule in the coding playbook, or the [progressive disclosure](./progressive-disclosure.md) conventions (orchestrator/helper pattern, modularization, cascading structure). If a step has no source, cut it or find the rule that justifies it.
- **Tests are steps.** Every behavior the spec's `outcomes.desired` names gets a corresponding test step in the plan.
- **Decisions section is not optional.** The architect records *why* each structural choice was made. This prevents the implementor from second-guessing decisions mid-build and prevents future architects from re-debating settled choices.

## Lifecycle

1. **Created** by the architect agent during `/aide:plan`.
2. **Presented to the user** for approval before `/aide:build` begins. The orchestrator pauses here.
3. **Consumed** by the implementor during `/aide:build` — checkboxes track progress.
4. **Retained** after build completes — the plan is an audit trail of what was decided and why.

## Placement

`plan.aide` lives next to the `.aide` it implements:

```
src/service/<feature>/
├── .aide          ← intent spec
├── plan.aide      ← implementation plan
├── index.ts
└── ...
```

No cross-referencing needed. The folder is the relationship.
