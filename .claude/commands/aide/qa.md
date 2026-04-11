# /aide-qa — QA Phase

Verify actual output against the intent spec. This is the QA agent phase — the session that turns the spec's `outcomes` block into a machine-readable rubric and produces a `todo.aide` checklist of discrete issues.

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`) in the target module
- [ ] Walk the full `.aide` chain from root to leaf with `aide_discover` — ancestor outcomes still apply to this module's output
- [ ] Focus on the `outcomes` block specifically:
  - Does the actual output satisfy every item in `outcomes.desired`?
  - Does the actual output trip any item in `outcomes.undesired`?
- [ ] Check for hidden failures — outputs that pass tests but violate intent, missing edge cases the spec names, anti-patterns the spec warned against
- [ ] Use judgement. If an output sounds wrong, reads wrong, or misses the point of the intent paragraph, flag it even when no specific outcome rule is named
- [ ] Produce or update a `todo.aide` checklist next to the spec. Use `aide_scaffold` with type `todo` if none exists yet
- [ ] Each issue gets:
  - A checkbox
  - A file path and line reference where the problem appears
  - A one-line description of what's wrong
  - A reference to the spec section or `outcomes` field it violates
- [ ] Do NOT propose solutions. The checklist says *what's wrong and where* — the implementor, invoked via `/aide:fix`, decides *how*
- [ ] Hand off to `/aide:fix` — the implementor will work the checklist one item per session
