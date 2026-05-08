# /aide:qa — QA Phase

> **Agent:** This command is executed by the `aide-qa` agent.

Verify actual output against the intent spec. This is the QA agent phase — the session that compares the spec's `outcomes` block against actual implementation and produces a `todo.aide` re-alignment document. See [todo.aide spec](../../.aide/docs/todo-aide.md) for the file format.

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`) in the target module
- [ ] Read `brief.aide` if present — the architectural-commitments file. Use it to clarify what valid output looks like at the structural level when an outcome is ambiguous, and to verify the implementation didn't quietly diverge from a committed contract. **You read `brief.aide`; you do not modify it.**
- [ ] Focus on the `outcomes` block specifically:
  - Does the actual output satisfy every item in `outcomes.desired`?
  - Does the actual output trip any item in `outcomes.undesired`?
- [ ] Check for hidden failures — outputs that pass tests but violate intent, missing edge cases the spec names, anti-patterns the spec warned against, implementation diverging from `brief.aide` commitments
- [ ] Use judgement. If an output sounds wrong, reads wrong, or misses the point of the intent paragraph, flag it even when no specific outcome rule is named
- [ ] What you do NOT verify: items already enforced by the type system, by unit tests, or by code review — those run on every commit. Your concern is the failure mode none of them catches: technically valid output that violates intent
- [ ] Produce a `todo.aide` next to the spec. Use `aide_scaffold` with type `todo` if none exists yet. Format:
  - **Frontmatter:** `intent` (which outcomes are violated), `misalignment` (array of pipeline stages where intent was lost — `spec-gap`, `research-gap`, `strategy-gap`, `plan-gap`, `implementation-drift`, `test-gap`)
  - **`## Issues`** — each issue gets:
    - A checkbox
    - A file path and line reference where the problem appears
    - A one-line description of what's wrong
    - `Traces to:` which `outcomes` field (desired or undesired) it violates
    - `Misalignment:` which pipeline stage lost the intent for this specific issue
  - **`## Retro`** — what would have caught this earlier? Which stage needs strengthening?
- [ ] Do NOT propose solutions. The checklist says *what's wrong and where* — the implementor, invoked via `/aide:fix`, decides *how*
- [ ] Hand off to `/aide:fix` — the implementor will work the checklist one item per session
