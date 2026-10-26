# plan.aide Spec

The architect's implementation plan. A `plan.aide` lives next to the `.aide` intent spec it implements — same folder, progressive disclosure tells the implementor which intent it serves.

## Format

```yaml
---
status: proposed
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

.aide specs go on modules: orchestrator index files and any folder with its
own plan. Helper folders inside a module are self-explanatory by name and do
not get specs.

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

Read: `<address of the modularization entry>`, `<address of the orchestrator-helper entry>` — section "Thin orchestrators"

- [ ] What to do, which files, what contracts

### 2. Coupled step title — requires shared context

Read: `<address of the unit-tests entry>`

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

- **`status` is always present.** It is the plan's lifecycle state: `proposed` → `approved` → `completed`, an `approved` plan drops back to `proposed` when it is revised, and an open plan can be `abandoned`. `completed` and `abandoned` are final. Scaffold writes `proposed`; every later change goes through `aide_frontmatter`, never a hand edit. The plan records its own state, never the work's: an `approved` plan is what lets implementation start.
- **Fits the approved project tree.** The module's folder and its place under its parent come from the project tree the user approved before any spec below the root was written (recorded in `session.aide`). A plan works inside that tree; one that needs a module moved, split or re-parented goes back to the architect's structure proposal and a fresh approval instead.
- **Single-module scoping.** A plan.aide only describes what gets built inside the module it lives in. The Project Structure tree shows the proposed state of THAT scope directory after implementation — nothing outside it.
- **No plan without a spec.** A plan is written only in a folder that already holds the intent spec it implements; `aide_scaffold` refuses to create one anywhere else, and `aide_validate` flags any plan with no spec beside it. When planning shows that a module with no spec needs work — a shared types folder, a shared-helpers folder, a single-file module, any prerequisite — the architect does not plan it. It names the module in its return, the orchestrator has its spec written (frontmatter only is enough; a folder that does not exist yet goes through the structure gate first), and only then is it planned.
- **Multi-plan splitting.** When a feature requires work across multiple modules, the architect produces multiple plan.aide files — one per module that needs new code, each beside that module's spec. Prerequisite modules get their plan.aide first; dependent modules declare them in `## Prerequisites`. Each plan is scoped to its own directory and follows the same rules independently. The orchestrator (`/aide:build`) executes them in dependency order — prerequisites before dependents.
- **Frontmatter is minimal.** `status` and `intent` only. No `spec` pointer — the plan lives next to the spec it implements, and progressive disclosure makes the relationship obvious.
- **`## Project Structure` is required — always, unconditionally.** Every plan must include a `## Project Structure` section (after frontmatter, before `## Plan`) containing the complete annotated folder tree of the module, rooted at the scope directory. This applies to every plan — greenfield, additive, refactor, any kind. The implementor must never have to figure out the module's structure; that is the architect's job. Every file that will exist after execution appears in the tree, annotated with what it does and its function signature (parameters and return type). For additive plans, annotate which files are new vs. already existing. `.aide` specs appear on modules — orchestrator `index` files and any folder with its own plan; helper folders inside a module do not get specs.
- **Changes to existing code are surgical.** When a plan touches existing code, change only the functions and lines the spec's outcomes require — no rewrites of working modules, no restructuring, renames, or opportunistic cleanups. Prefer adding a small new helper over reshaping an existing one. In `## Project Structure`, every MODIFIED file carries a one-line note naming exactly what changes and why. A rewrite is allowed only when the spec explicitly calls for it (e.g. a refactor plan) and `## Decisions` justifies it.
- **Every step gets a checkbox.** The implementor checks each box as it completes during `/aide:build`. Unchecked boxes are pending work; checked boxes are done.
- **Steps execute top-to-bottom.** Sequencing is the architect's job. The implementor does not reorder, skip, or add steps. If a step is ambiguous, escalate back to `/aide:plan`. Each numbered step is executed by a fresh implementor agent. Lettered sub-steps within a number share a single agent session.
- **Each numbered step is a unit of delegation.** The orchestrator spawns one fresh implementor agent per numbered step. This means each step must be self-contained: a fresh agent should be able to execute it by reading the plan, the `.aide` spec, and the current code state — without knowing what a prior agent did in-memory. Write steps at a granularity where each one produces a complete, testable change.
- **Lettered sub-steps for coupled work.** When multiple actions are tightly coupled and cannot be executed independently (e.g., creating a helper and immediately wiring it into the caller), group them as lettered sub-steps under a single number: `1a`, `1b`, `1c`. The orchestrator keeps one agent for all sub-steps of a given number. Use this sparingly — most steps should be independent. If you find yourself lettering more than you're numbering, the steps are too granular.
- **No implementation code.** No function bodies, no algorithms expressed as code, no copy-paste snippets. But the following ARE allowed because they are architectural decisions, not implementations: type shapes (field names, types, unions), function signatures (what it takes and returns — these also appear in the Project Structure tree annotations), pipeline sequences described declaratively ("compute X → apply Y → check Z → if triggered, override"), threshold values and domain constants from the spec, and API endpoints with their validation schemas. The line is: **if an implementor would have to invent it, it belongs in the plan. If the playbook already covers it** (naming, file size, decomposition, error handling patterns), **it belongs in the Read list.**
- **Every step has a Read list.** Each numbered step must open with a `Read:` line listing 1-3 coding playbook entries from the brain that the implementor should read before coding that step. These are the **convention entries** — playbook rules that govern how the implementor writes the code for that step (decomposition, naming, file size, patterns, testing style). The architect already consulted the playbook during planning; the Read list tells the implementor exactly which entries to load so it applies the same conventions. The implementor has direct playbook access via the `study-playbook` skill and will read these entries itself — the architect does not need to encode convention details into the plan text. **Each entry is the exact address the architect loaded it with**, copied from its own successful read and never retyped: the brain's read tool decides what an address looks like, so the address that worked for the architect works for the implementor, whatever the brain is. A section of an entry is named in words after the address, never as an anchor. The examples in this doc show the shape of a `Read:` line, not any brain's address format.
- **Every step traces to intent.** Each step must be traceable back to a line in the `.aide` spec, a rule in the coding playbook, or the [progressive disclosure](./progressive-disclosure.md) conventions (orchestrator/helper pattern, modularization, cascading structure). If a step has no source, cut it or find the rule that justifies it.
- **Tests are steps.** Every behavior the spec's `outcomes.desired` names gets a corresponding test step in the plan.
- **Decisions section is not optional.** The architect records *why* each structural choice was made. This prevents the implementor from second-guessing decisions mid-build and prevents future architects from re-debating settled choices.
- **Read lists are not optional.** The architect consults the playbook during planning and encodes the relevant conventions as a `Read:` list pointing the implementor to the specific playbook entries that govern each step. The implementor has direct playbook access and will load those entries itself. The architect's job is to pick the right entries, not to transcribe their contents into the plan.

## Lifecycle

1. **Created** by the architect agent during `/aide:plan`, starting `proposed`.
2. **Presented to the user** for approval before `/aide:build` begins. The orchestrator pauses here; on the user's yes (or the agent's, when the project skips human review) it moves the plan — and its `brief.aide`, if there is one — to `approved` through `aide_frontmatter`. Revising an approved plan drops it back to `proposed` until it is approved again.
3. **Consumed** by the implementor during `/aide:build` — only while the plan reads `approved`; checkboxes track progress.
4. **Deleted** by the maintainer agent after QA passes — the code is the durable artifact, the plan was scaffolding for the build. Future audit goes to git history + the code itself. Before removal the maintainer moves the plan to `completed` through `aide_frontmatter`, which refuses while any step is unchecked. Removal goes through `aide_cleanup`, which removes a plan only when it is `completed` (re-checked) or `abandoned`, together with the module's `todo.aide` (if closed) and `brief.aide`. A plan the user discards — abandoned halfway, or never used — is marked `abandoned` instead and goes with its brief. QA may write a `todo.aide` in a module this plan built but does not live in; that todo is removed on its own once closed.

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
