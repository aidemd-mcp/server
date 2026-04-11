# /aide-qa — QA Phase

Audit implementation against the intent spec.

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`)
- [ ] Compare actual implementation output against the spec
- [ ] Check for hidden failures:
  - Things that pass tests but violate intent
  - Missing edge cases from the spec
  - Anti-patterns the spec warned against
- [ ] Produce a `todo.aide` checklist of issues found
- [ ] Each issue gets:
  - A checkbox
  - Description of the issue
  - Reference to which spec section it violates
- [ ] Use `aide_scaffold` with type `todo` if no `todo.aide` exists yet
