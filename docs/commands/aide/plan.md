# /aide-plan — Plan Phase

Translate the intent spec into a step-by-step implementation plan the implementor can execute without making architectural decisions.

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`) in the target module
- [ ] Walk the full `.aide` chain from root to leaf — ancestor outcomes still apply
- [ ] Pull the coding playbook from the brain — naming conventions, folder structure, patterns to follow and anti-patterns to avoid
- [ ] Scan the target module and its neighbors to understand what already exists — existing helpers to reuse, existing patterns to match, folders already in place
- [ ] Produce a step-by-step implementation plan the implementor can execute top-to-bottom. The plan must name:
  - Which files to create and where they live
  - Which existing helpers to reuse instead of writing new ones
  - Function boundaries and the contract between each step
  - Sequencing — what must exist before the next step can start
  - Tests to write for each behavior the spec's `outcomes.desired` names
- [ ] No code in the plan — no function bodies, no worked examples, no copy-paste snippets. The plan describes decisions; the implementor writes the code
- [ ] Every step must be traceable back to a line in the `.aide` spec or a rule in the coding playbook. If a step has no source, cut it or find the rule that justifies it
- [ ] If the spec is ambiguous, stop and escalate back to the planner rather than inventing an answer
- [ ] Hand the plan to the implementor via `/aide:build`
