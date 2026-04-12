# /aide-plan — Plan Phase

Translate the intent spec into a step-by-step implementation plan. Output is a `plan.aide` file next to the `.aide` spec — checkboxed steps the implementor executes without making architectural decisions. See [plan.aide spec](../../.aide/docs/plan-aide.md) for the file format.

## Checklist

- [ ] Use `aide_discover` to walk the full `.aide` chain from root to leaf — ancestor outcomes still apply
- [ ] Read the complete intent spec (`.aide` or `intent.aide`) in the target module — frontmatter AND body sections must be filled. If body sections are empty, stop and escalate back to `/aide:synthesize`
- [ ] Pull the coding playbook from the brain — naming conventions, folder structure, patterns to follow and anti-patterns to avoid
- [ ] Scan the target module and its neighbors to understand what already exists — existing helpers to reuse, existing patterns to match, folders already in place
- [ ] Write `plan.aide` next to the `.aide` spec with:
  - **Frontmatter:** `intent` — one-line summary of what this plan delivers
  - **`## Plan`** — checkboxed steps the implementor executes top-to-bottom:
    - Which files to create and where they live
    - Which existing helpers to reuse instead of writing new ones
    - Function boundaries and the contract between each step
    - Sequencing — what must exist before the next step can start
    - Tests to write for each behavior the spec's `outcomes.desired` names
  - **`## Decisions`** — architectural choices made: why X over Y, naming rationale, tradeoffs
- [ ] No code in the plan — no function bodies, no worked examples, no copy-paste snippets. The plan describes decisions; the implementor writes the code
- [ ] Every step must be traceable back to a line in the `.aide` spec or a rule in the coding playbook. If a step has no source, cut it or find the rule that justifies it
- [ ] If the spec is ambiguous, stop and escalate back to the planner rather than inventing an answer
- [ ] **PAUSE for user approval.** Present the plan and do not proceed until the user approves it. Iterate if the user requests changes
- [ ] Hand the approved plan to the implementor via `/aide:build`
