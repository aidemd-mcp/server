# todo.aide Spec

The QA re-alignment document. A `todo.aide` captures where the implementation drifted from canonical intent and provides a structured work queue to bring it back. One `todo.aide` per QA loop, living next to the `.aide` it audits.

## Format

```yaml
---
status: proposed
intent: >
  One-line summary of which `.aide` outcome(s) are violated — the gap
  between what the spec says and what the code actually produces.
misalignment:
  - <where in the pipeline intent was lost — one or more of the values below>
---
```

### Misalignment values

Each entry in `misalignment` names the pipeline stage where intent was lost in translation:

| Value | Meaning |
|-------|---------|
| `spec-gap` | The intent spec didn't capture something important — a missing outcome, an ambiguous intent, an edge case the spec should have named |
| `research-gap` | Domain knowledge was incomplete, outdated, or wrong — the brain didn't have what the strategist needed |
| `strategy-gap` | Strategy didn't account for an edge case or made a decision that doesn't hold under real conditions |
| `plan-gap` | The architect missed a step, made a wrong structural call, or left ambiguity the implementor had to improvise around |
| `implementation-drift` | Code deviated from the plan — the implementor made an unauthorized architectural decision or misread a step |
| `test-gap` | Tests passed but didn't cover the failure mode — green tests, wrong output |
| `spec-bloat` | The spec violates the [Brevity Contract](./aide-spec.md#brevity-contract) — over-cap fields, paragraph-length outcomes, sprawling body sections, whole-file size past the ~175-line refactor signal, or forbidden content (type signatures, file paths, argument indexes, schema cardinality, migration history, function-name enumerations standing in for outcomes) |

Multiple values are allowed. A single QA run often surfaces issues from different pipeline stages.

## Body

```markdown
## Issues

- [ ] **path/to/file.ts:42** — What's wrong in one line.
      Traces to: `outcomes.undesired[1]` | Misalignment: `implementation-drift`
- [ ] **path/to/file.ts:87** — Next issue, same format.
      Traces to: `outcomes.desired[3]` | Misalignment: `strategy-gap`

## Retro

What would have caught this earlier? Which stage needs strengthening?
Specific observations — not generic process advice.
```

## Rules

- **One `todo.aide` per QA loop.** Each QA run produces a fresh `todo.aide`. If a prior one exists, the QA agent replaces it — checked items from a previous loop are history, not carry-forward.
- **Each issue gets a checkbox.** The implementor checks it off when the fix lands and no regression is introduced.
- **Each issue traces to intent.** Every checkbox references which `outcomes` field (desired or undesired) the issue violates. Issues that don't trace to an outcome don't belong in the file.
- **Each issue names its misalignment.** Per-issue `Misalignment` tags complement the frontmatter-level `misalignment` array. Frontmatter is the summary; per-issue tags are the detail.
- **No solutions.** The QA agent says *what's wrong and where*. The implementor decides *how* to fix it. Solutions in the todo bias the fixer toward an approach before they've read the spec.
- **One checkbox per fix session.** The implementor picks the next unchecked item, fixes it in a clean session, and stops. No bundling. See [Automated QA](./automated-qa.md) for the rationale.
- **Retro is required.** The `## Retro` section captures what would have prevented the misalignment. The orchestrator promotes retro findings to the brain at `process/retro/` when the fix loop closes — durable process learning that future sessions can draw from.

## Placement

`todo.aide` lives next to the `.aide` it audits:

```
src/service/<feature>/
├── .aide          ← intent spec
├── plan.aide      ← implementation plan
├── todo.aide      ← QA re-alignment
├── index.ts
└── ...
```

QA writes `todo.aide` beside the code it verifies. That folder need not hold a `plan.aide`: a build can be planned in another module's plan and still touch this one, and the `todo.aide` then sits alone. A fully checked `todo.aide` is its own proof that its fix loop closed, so it is removed with or without a plan beside it.

## Lifecycle

1. **Created** by the QA agent during `/aide:qa` using `aide_scaffold type=todo`, starting `status: proposed`.
2. **Triaged and approved by the orchestrator** — never by the user. The fix loop is agents checking agents' work: the orchestrator routes each item by its misalignment tag and moves the list to `approved` through `aide_frontmatter`.
3. **Consumed** by the implementor during `/aide:fix` — one item per session, only while the list reads `approved`.
4. **Re-validated** by QA after fixes land — may produce a new `todo.aide` if issues remain.
5. **Retro promoted** by the orchestrator to `process/retro/` in the brain when all items are checked.
6. **Deleted** by the maintainer agent after QA passes — the issues have been fixed; retro is promoted to brain at `process/retro/` BEFORE deletion. The fixes themselves are the durable artifact; the todo list was scaffolding for the fix loop. The maintainer first moves the list to `completed` through `aide_frontmatter`, which refuses while any item is open. Removal goes through `aide_cleanup`, which removes a `todo.aide` only when it is `completed` (re-checked) or `abandoned`, whether or not a `plan.aide` sits beside it.
