# /aide:build — Build Phase

> **Agent:** This command is executed by the `aide-implementor` agent.

Execute the architect's implementation plan. This is the implementor phase in build mode — the session that turns `plan.aide` into working, tested code without making architectural decisions mid-session.

## Checklist

- [ ] Read `plan.aide` in the target module. This is the primary input — it names files, sequencing, contracts, and which existing helpers to reuse
- [ ] Read the intent spec (`.aide` or `intent.aide`) for the target module. The plan tells you what to build; the spec tells you what counts as correct
- [ ] Execute the plan steps top-to-bottom. Check each checkbox in `plan.aide` as you complete it. Do not reorder steps, skip steps, or add steps. If a step is ambiguous, stop and escalate back to the architect via `/aide:plan` rather than inventing an answer
- [ ] Write the code. No architectural improvisation — if a decision is not in the plan or the spec, it is out of scope for this session
- [ ] Write tests covering every behavior the spec's `outcomes.desired` names, plus regression coverage for anything in `outcomes.undesired`
- [ ] Run the tests until green
- [ ] Run the type checker (`tsc --noEmit` or the project's equivalent)
- [ ] Run `aide_validate` to check for spec issues introduced during the build
- [ ] Hand off to `/aide:qa` — the QA agent will compare actual output against the spec's `outcomes` block
