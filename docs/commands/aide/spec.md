# /aide-spec — Spec Phase

Write the intent spec from research findings.

## Checklist

- [ ] Read the `research.aide` if one exists in the target folder
- [ ] Write the intent spec:
  - Use `.aide` if no `research.aide` exists
  - Use `intent.aide` if `research.aide` exists
- [ ] Include in the spec:
  - Strategy: high-level flow, key decisions and why
  - Implementation contracts: TypeScript types, function signatures
  - Anti-patterns: what NOT to do
  - Worked examples: abstract rules plus concrete examples
- [ ] Every section must be actionable — if it doesn't help make a decision, cut it
- [ ] Spec must stand alone — a reader understands it without reading other specs
- [ ] Run `aide_validate` to check for spec issues
