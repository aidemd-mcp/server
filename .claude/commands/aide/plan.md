# /aide:plan — Plan Phase

> **Agent:** This command is executed by the `aide-architect` agent.

Translate the intent spec into a step-by-step implementation plan. Output is a `plan.aide` file next to the `.aide` spec — checkboxed steps the implementor executes without making architectural decisions. See [plan.aide spec](../../.aide/docs/plan-aide.md) for the file format.

## Checklist

- [ ] Read the complete intent spec (`.aide` or `intent.aide`) in the target module — frontmatter AND body sections must be filled. If body sections are empty, stop and escalate back to `/aide:synthesize`
- [ ] Pull the coding playbook from the brain using the `study-playbook` skill — naming conventions, folder structure, patterns to follow and anti-patterns to avoid
- [ ] Scan the target module and its neighbors to understand what already exists — existing helpers to reuse, existing patterns to match, folders already in place
- [ ] Write `plan.aide` next to the `.aide` spec with:
  - **Frontmatter:** `intent` — one-line summary of what this plan delivers
  - **`## Project Structure`** — the complete annotated folder tree of the module, rooted at the scope directory. This IS the recipe blueprint — every plan includes it unconditionally, whether greenfield or additive. The implementor must never figure out the module's structure; that is the architect's job. Every file that will exist after execution appears in the tree, annotated with what it does and its function signature (parameters and return type). For additive plans, mark which files are new vs. existing. `.aide` specs go next to orchestrators, not helpers.
  - **`## Plan`** — checkboxed steps (the "cooking order" for the recipe above):
    - Each step references files from the Project Structure tree
    - Type shapes, function signatures (in prose), declarative pipeline sequences, thresholds — these are contracts, include them
    - Which existing helpers to reuse instead of writing new ones
    - Sequencing — what must exist before the next step can start
    - Tests to write for each behavior the spec's `outcomes.desired` names
  - **`## Decisions`** — architectural choices made: why X over Y, naming rationale, tradeoffs
- [ ] No implementation code — no function bodies, no algorithms as code, no copy-paste snippets. But contracts ARE required: type shapes, function signatures in prose, declarative pipeline sequences, thresholds from the spec, API schemas. **If an implementor would have to invent it, put it in the plan. If the playbook covers it, put it in the Read list.**
- [ ] Every step must be traceable back to a line in the `.aide` spec or a rule in the coding playbook. If a step has no source, cut it or find the rule that justifies it
- [ ] If the spec is ambiguous, stop and escalate back to the spec writer (via the orchestrator) rather than inventing an answer
- [ ] **PAUSE for user approval.** Present the plan and do not proceed until the user approves it. Iterate if the user requests changes
- [ ] Hand the approved plan to the implementor via `/aide:build`
