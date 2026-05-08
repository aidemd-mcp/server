# brief.aide Spec

The architect's pre-read. A `brief.aide` carries the implementation contracts — type shapes, exact strings, schema details, cross-module contracts, open questions, and any mid-flight rework state — that the architect needs to plan, the implementor needs to build, and QA needs to verify against. It is the home for content kicked out of `.aide` outcomes by the [Brevity Contract](./aide-spec.md#brevity-contract).

It is **ephemeral**: created during synthesize, lives through plan/build/QA/fix, deleted by the maintainer agent after QA passes.

## Why This Exists

`.aide` files stay short and refactor-proof because the Brevity Contract forbids implementation contracts (type signatures, exact strings, marker tokens, schema cardinality, cross-module API contracts, migration history) in outcomes and body sections. Those contracts are enforced by the type system, unit tests, and code review — not by QA reading English in a spec file.

But the *architect* needs that implementation context to plan. The *implementor* needs it to build. The *QA agent* sometimes needs it to clarify what valid output looks like. No single agent can hold it all in memory across phases. It needs a home.

`brief.aide` is that home — a per-module working file that resets when the feature closes.

## Format

```yaml
---
intent: >
  One-line summary of what this brief is about. Mirrors the `.aide` intent
  but framed as "the slice of work currently in flight."
---
```

```markdown
## Commitments

Numbered architectural commitments the implementation currently honors. Each
commitment is a stable fact about the module's shape until a deliberate
refactor decides to change it. The architect needs these to plan; the
implementor needs them to build without re-deriving the contract; QA needs
them to know what "valid output" looks like at the structural level.

1. **<title>**. <one-paragraph statement of what's true now.>
2. **<title>**. <next commitment.>

Numbers persist across edits — when a commitment is removed, leave the gap
rather than renumbering. This stabilizes references in plan.aide, todo.aide,
and PR descriptions.

## Cross-module contracts

What this module promises to neighbors and what it consumes from them. The
architect uses this to know what's safe to change without coordinating with
other modules.

- This module exposes `<X>` consumed by `<Y>`
- This module consumes `<Z>` from `<W>`

## Open questions

Decisions in flight. Cleared when resolved.

- <question> — pending decision on <thing>

## Mid-flight rework state

Optional. Only when work is paused mid-pipeline. What stage we are in, what
is done, what is next. The orchestrator's resume protocol consults this
section when picking up an interrupted brief.
```

## Rules

- **Implementation contracts are allowed and expected.** Type signatures, exact strings, marker tokens, schema enumerations, argument indexes, function signatures — all welcome here. This is the home for content kicked out of `.aide` outcomes.
- **No domain reasoning.** Why-it-matters domain rationale lives in `.aide` Strategy. `brief.aide` is what's true *right now* about the architecture, not why.
- **Numbered commitments are stable references.** When a plan step says "honor commitment #11," that number must keep meaning the same thing throughout the brief. Removing a commitment leaves a gap; new commitments append.
- **No cascading.** Each `brief.aide` stands alone. There is no inheritance from parent or root briefs — these are local working notes, not propagated intent.
- **Not aligned, not validated.** The aligner does not walk `brief.aide` files. They are working memory, not intent. `aide_validate` does not warn about them.
- **No frontmatter beyond `intent`.** No `scope`, no `outcomes`, no `status`. The file is per-feature working memory, not a structural artifact.

## Lifecycle

1. **Created** by the strategist during `/aide:synthesize` as a sibling of the `.aide` spec. The strategist authors `brief.aide` alongside the body sections — implementation contracts that surfaced during synthesis (type-level commitments the strategy implies, exact strings the domain requires, cross-module contracts emerging from the research) land here, NOT in the `.aide` body. The architect reads it during plan to decide what to build.
2. **Read** by the architect during `/aide:plan` — it is the architect's pre-read, providing the implementation context needed to write `plan.aide`. Read by the implementor during `/aide:build` — provides the contracts the code must honor. Read by QA during `/aide:qa` — clarifies what valid output looks like at the structural level.
3. **Updated** mid-pipeline:
   - The architect appends commitments and resolves open questions when planning — new architectural decisions made during plan land here.
   - The implementor updates commitments and resolves open questions when build decisions land them — e.g. an open question "should we cache parsed results within an init invocation?" becomes commitment #14 "parsed results are cached within a single init invocation, not across runs."
   - The QA agent does NOT update the file — its job is to verify, not to commit.
4. **Deleted** by the maintainer agent after QA passes. Once `todo.aide` is fully checked AND the retro is promoted to brain, the maintainer cleans up the per-module ephemeral artifacts (`brief.aide`, `plan.aide`, `todo.aide`). After deletion, the code itself documents the architectural shape per progressive disclosure (Tier 1 folder structure, Tier 2 JSDoc + signatures, Tier 3 orchestrator inline comments). The `brief.aide` was scaffolding for the in-flight work; the code is the durable artifact.

## Placement

`brief.aide` lives next to the `.aide` it accompanies:

```
src/service/<feature>/
├── .aide          ← durable intent spec
├── brief.aide     ← architect's pre-read (this file)
├── plan.aide      ← architect's implementation plan
├── todo.aide      ← QA re-alignment
├── index.ts
└── ...
```

When a feature spans multiple modules (multi-plan), each module gets its own `brief.aide` independently. There is no cross-module brief coupling.

## Distinction from `plan.aide`

| | `plan.aide` | `brief.aide` |
|---|---|---|
| Lifespan | Per build (architect → implementor → deleted post-QA) | Per feature (synthesize → plan → build → QA → deleted post-QA) |
| Owner | Architect produces; implementor checks off | Strategist creates; architect/implementor update commitments; QA reads |
| Content | What to BUILD this round (steps, file structure, sequencing) | What is CURRENTLY TRUE about the module's architecture (commitments, contracts, open questions) |
| Survives multiple builds? | Each build has its own plan | One per feature; spans multiple builds within the feature |

A plan is a recipe. A brief is the kitchen's current state. The recipe says what to cook this round; the brief says what ingredients are on the counter, what's in the fridge, and which questions about substitutions are still open.

## Distinction from `.aide`

| | `.aide` | `brief.aide` |
|---|---|---|
| Lifespan | Durable; survives across features | Ephemeral; deleted after QA passes |
| Bound by Brevity Contract? | Yes — caps + forbidden content | No — implementation contracts welcome |
| Aligned by aligner? | Yes (cascade + brevity + sibling-redundancy) | No |
| Cascades to children? | Yes — children inherit ancestor outcomes | No |
| Survives a rewrite of the implementation? | Yes — the spec is intent | No — the next brief re-derives from current code |

`.aide` is the contract with the *domain*. `brief.aide` is the working notepad for the *current implementation*. Both are needed; neither replaces the other.

## Distinction from `session.aide`

`session.aide` is a different artifact entirely — a single root-level pipeline-position log at `.aide/session.aide` that tracks where the in-flight feature stands across cycles. `brief.aide` is per-module and carries implementation contracts; `session.aide` is project-wide and carries pipeline state. See [session.aide spec](./session-aide.md).
