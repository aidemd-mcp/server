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
## Project Structure

The folder tree is the recipe blueprint — the architect's complete specification
of the module's structure. The implementor must never have to figure out what
files to create or what contracts they expose; that is the architect's job.

Every plan — greenfield or additive — includes the complete folder tree of the
module it governs, rooted at the scope directory (the same folder where this
plan.aide lives). Every file that will exist after the plan executes appears in
the tree, annotated with what it does and its function signature (parameters
and return type). For additive plans, mark which files are new vs. already
existing.

.aide specs go next to orchestrator index files, not next to helpers.
Helper folders are self-explanatory by name and do not get specs.

The numbered steps below are the cooking order — which parts of the recipe to
build first and which playbook conventions apply. The tree is the "what"; the
steps are the "when."

```
<feature>/
├── .aide                          ← intent spec for this orchestrator
├── index.ts                       ← orchestrator: (input: RawData) => ProcessedResult
├── helperOne/
│   └── index.ts                   ← (raw: RawData) => NormalizedData
├── helperTwo/
│   └── index.ts                   ← (data: NormalizedData) => ScoredData
└── helperThree/
    └── index.ts                   ← (scored: ScoredData) => ProcessedResult
```

## Prerequisites

Modules that must be built before this plan can execute. The architect
produces plan.aide files for prerequisite modules first; the orchestrator
executes them in dependency order before reaching this plan.

Each entry declares the module, what it must export (the interface contract
this plan expects), and that it must exist before this plan's steps run.
Never prescribe the internal structure of a prerequisite — only the contract
this plan consumes.

- `@/lib/redis` must export `{ redis: Redis | null, isRedisAvailable: () => Promise<boolean> }`
- `@/lib/email` must export `sendEmail: (to: string, subject: string, body: string) => Promise<void>`

## Plan

### 1. Step title — self-contained unit

Read: `coding-playbook/structure/modularization`, `coding-playbook/patterns/orchestrator-helper`

- [ ] What to do, which files, what contracts

### 2. Coupled step title — requires shared context

Read: `coding-playbook/testing/unit-tests`

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

- **Single-module scoping.** A plan.aide only describes what gets built inside the module it lives in. The Project Structure tree shows the proposed state of THAT scope directory after implementation — nothing outside it.
- **Multi-plan splitting.** When a feature requires work across multiple modules, the architect produces multiple plan.aide files — one per module that needs new code. Prerequisite modules get their plan.aide first; dependent modules declare them in `## Prerequisites`. Each plan is scoped to its own directory and follows the same rules independently. The orchestrator (`/aide:build`) executes them in dependency order — prerequisites before dependents.
- **Frontmatter is minimal.** `intent` only. No `status`, no `spec` pointer — the plan lives next to the spec it implements, and progressive disclosure makes the relationship obvious.
- **`## Project Structure` is required — always, unconditionally.** Every plan must include a `## Project Structure` section (after frontmatter, before `## Plan`) containing the complete annotated folder tree of the module, rooted at the scope directory. This applies to every plan — greenfield, additive, refactor, any kind. The implementor must never have to figure out the module's structure; that is the architect's job. Every file that will exist after execution appears in the tree, annotated with what it does and its function signature (parameters and return type). For additive plans, annotate which files are new vs. already existing. `.aide` specs appear next to orchestrator `index` files; helper folders do not get specs.
- **Every step gets a checkbox.** The implementor checks each box as it completes during `/aide:build`. Unchecked boxes are pending work; checked boxes are done.
- **Steps execute top-to-bottom.** Sequencing is the architect's job. The implementor does not reorder, skip, or add steps. If a step is ambiguous, escalate back to `/aide:plan`. Each numbered step is executed by a fresh implementor agent. Lettered sub-steps within a number share a single agent session.
- **Each numbered step is a unit of delegation.** The orchestrator spawns one fresh implementor agent per numbered step. This means each step must be self-contained: a fresh agent should be able to execute it by reading the plan, the `.aide` spec, and the current code state — without knowing what a prior agent did in-memory. Write steps at a granularity where each one produces a complete, testable change.
- **Lettered sub-steps for coupled work.** When multiple actions are tightly coupled and cannot be executed independently (e.g., creating a helper and immediately wiring it into the caller), group them as lettered sub-steps under a single number: `1a`, `1b`, `1c`. The orchestrator keeps one agent for all sub-steps of a given number. Use this sparingly — most steps should be independent. If you find yourself lettering more than you're numbering, the steps are too granular.
- **No implementation code.** No function bodies, no algorithms expressed as code, no copy-paste snippets. But the following ARE allowed because they are architectural decisions, not implementations: type shapes (field names, types, unions), function signatures (what it takes and returns — these also appear in the Project Structure tree annotations), pipeline sequences described declaratively ("compute X → apply Y → check Z → if triggered, override"), threshold values and domain constants from the spec, and API endpoints with their validation schemas. The line is: **if an implementor would have to invent it, it belongs in the plan. If the playbook already covers it** (naming, file size, decomposition, error handling patterns), **it belongs in the Read list.**
- **Every step has a Read list.** Each numbered step must open with a `Read:` line listing 1-3 coding playbook notes from the brain that the implementor should read before coding that step. These are the **convention notes** — playbook rules that govern how the implementor writes the code for that step (decomposition, naming, file size, patterns, testing style). The architect already consulted the playbook during planning; the Read list tells the implementor exactly which notes to load so it applies the same conventions. The implementor has direct playbook access via the `study-playbook` skill and will read these notes itself — the architect does not need to encode convention details into the plan text.
- **Every step traces to intent.** Each step must be traceable back to a line in the `.aide` spec, a rule in the coding playbook, or the [progressive disclosure](./progressive-disclosure.md) conventions (orchestrator/helper pattern, modularization, cascading structure). If a step has no source, cut it or find the rule that justifies it.
- **Tests are steps.** Every behavior the spec's `outcomes.desired` names gets a corresponding test step in the plan.
- **Decisions section is not optional.** The architect records *why* each structural choice was made. This prevents the implementor from second-guessing decisions mid-build and prevents future architects from re-debating settled choices.
- **Read lists are not optional.** The architect consults the playbook during planning and encodes the relevant conventions as a `Read:` list pointing the implementor to the specific playbook notes that govern each step. The implementor has direct playbook access and will load those notes itself. The architect's job is to pick the right notes, not to transcribe their contents into the plan.

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
