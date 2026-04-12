# /aide-qa — QA Phase

Verify actual output against the intent spec. This is the QA agent phase — the session that compares the spec's `outcomes` block against actual implementation and produces a `todo.aide` re-alignment document. See [todo.aide spec](../../.aide/docs/todo-aide.md) for the file format.

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`) in the target module
- [ ] Use `aide_discover` to walk the full `.aide` chain from root to leaf — ancestor outcomes still apply to this module's output
- [ ] Focus on the `outcomes` block specifically:
  - Does the actual output satisfy every item in `outcomes.desired`?
  - Does the actual output trip any item in `outcomes.undesired`?
- [ ] Check for hidden failures — outputs that pass tests but violate intent, missing edge cases the spec names, anti-patterns the spec warned against
- [ ] Use judgement. If an output sounds wrong, reads wrong, or misses the point of the intent paragraph, flag it even when no specific outcome rule is named
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
