# /aide:build — Build Phase

> **Agent:** This command is executed by the `aide-implementor` agent.

Execute the architect's implementation plan. This is the implementor phase in build mode — the session that turns `plan.aide` into working, tested code without making architectural decisions mid-session.

## Checklist

- [ ] Read `plan.aide` in the target module. This is the primary input — it names files, sequencing, and which existing helpers to reuse
- [ ] Read `brief.aide` in the same folder — the architectural-commitments file authored by the strategist during synthesize and refined by the architect during plan. Type shapes, exact strings, cross-module contracts, schema cardinality. Honor every commitment exactly. When a plan step says "honor commitment #11," #11 in `brief.aide` is the source of truth
- [ ] Check `## Prerequisites`. If the plan declares prerequisites, verify they exist and export the expected contracts before writing any code. If a prerequisite is missing or doesn't match, stop and escalate back to the orchestrator — do not improvise
- [ ] Read the intent spec (`.aide` or `intent.aide`) for the target module. The plan tells you what to build; `brief.aide` tells you the architectural shape it must take; the intent spec tells you what counts as domain-correct
- [ ] Execute the plan steps top-to-bottom. Check each checkbox in `plan.aide` as you complete it. Do not reorder steps, skip steps, or add steps. If a step is ambiguous, stop and escalate back to the architect via `/aide:plan` rather than inventing an answer
- [ ] When build resolves an open question from `brief.aide`, update the file: append a new numbered commitment capturing the resolution, remove the question from `## Open questions`. Numbers stay stable — do not renumber existing commitments
- [ ] Write the code. No architectural improvisation — if a decision is not in `plan.aide`, `brief.aide`, or `.aide`, it is out of scope for this session
- [ ] Write tests covering every behavior the spec's `outcomes.desired` names, plus regression coverage for `outcomes.undesired`. Tests are also where to assert `brief.aide` commitments the type system can't enforce alone (exact strings, schema cardinality, enum membership, parser rejection rules)
- [ ] Run the tests until green
- [ ] Run the type checker (`tsc --noEmit` or the project's equivalent)
- [ ] Run `aide_validate` to check for spec issues introduced during the build
- [ ] Hand off to `/aide:qa` — the QA agent will compare actual output against the spec's `outcomes` block (and consult `brief.aide` for structural clarification)
