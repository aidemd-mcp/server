# /aide:plan — Plan Phase

> **Agent:** This command is executed by the `aide-architect` agent.

Translate the intent spec into a step-by-step implementation plan. Output: `plan.aide` (the build recipe). The spec may be in one of two shapes: **Shape A** (synthesize ran — body sections filled, sibling `brief.aide` exists) or **Shape B** (synthesize skipped — frontmatter only, no `brief.aide`; the orchestrator's delegation prompt carries the user's implementation context as the architectural input). For Shape A, UPDATE `brief.aide` as planning surfaces new commitments. For Shape B, CREATE `brief.aide` only if planning surfaces commitments worth recording. See [plan.aide spec](../../.aide/docs/plan-aide.md) and [brief.aide spec](../../.aide/docs/brief-aide.md).

## Checklist

- [ ] Read the intent spec (`.aide` or `intent.aide`) in the target module. Frontmatter is always required. Body sections are present only in Shape A.
- [ ] Identify the shape: `brief.aide` exists → Shape A; `brief.aide` does not exist → Shape B. For Shape A, read the sibling `brief.aide` — its commitments are the current architectural state your plan must honor or deliberately retire; its open questions are decisions awaiting your settlement. For Shape B, the orchestrator's delegation prompt carries the user's implementation instructions verbatim — that's your architectural input.
- [ ] Pull the coding playbook from the brain using the `study-playbook` skill — naming conventions, folder structure, patterns to follow and anti-patterns to avoid
- [ ] Scan the target module and its neighbors to understand what already exists — existing helpers to reuse, existing patterns to match, folders already in place
- [ ] Write `plan.aide` next to the `.aide` spec with:
  - **Frontmatter:** `intent` — one-line summary of what this plan delivers
  - **`## Project Structure`** — the complete annotated folder tree of the module, rooted at the scope directory. This IS the recipe blueprint — every plan includes it unconditionally, whether greenfield or additive. The implementor must never figure out the module's structure; that is the architect's job. Every file that will exist after execution appears in the tree, annotated with what it does and its function signature (parameters and return type). For additive plans, mark which files are new vs. existing. `.aide` specs go next to orchestrators, not helpers.
  - **`## Plan`** — checkboxed steps (the "cooking order" for the recipe above):
    - Each step references files from the Project Structure tree
    - Steps may reference `brief.aide` commitments by number ("honor commitment #11")
    - Which existing helpers to reuse instead of writing new ones
    - Sequencing — what must exist before the next step can start
    - Tests to write for each behavior the spec's `outcomes.desired` names
  - **`## Decisions`** — architectural choices made: why X over Y, naming rationale, tradeoffs
- [ ] **Shape A (brief exists):** Update `brief.aide` (do NOT overwrite — the strategist authored it). **Shape B (no brief):** create `brief.aide` only if planning surfaced commitments worth recording; if the plan + spec frontmatter fully describe the module, do not create an empty file. Sections (when the file exists):
  - **`## Commitments`** — numbered commitments. Type shapes, function signatures, exact strings, schema cardinality, marker tokens, enumerations of accepted values. Numbers persist across edits — gaps stay when commitments are removed; new commitments append
  - **`## Cross-module contracts`** — what this module exposes/consumes vs. neighbors
  - **`## Open questions`** — design decisions deferred to build, cleared as they are answered downstream
- [ ] No implementation code in any file — no function bodies, no algorithms as code. Architectural contracts (types, signatures, exact strings, schema details) belong in `brief.aide` when one exists, otherwise in the plan step bullets. **If an implementor would have to invent it, name it explicitly. If the playbook covers it, put it in the plan step's Read list.**
- [ ] Every plan step must be traceable back to a line in the `.aide` spec, a `brief.aide` commitment, or a rule in the coding playbook. If a step has no source, cut it or find the rule that justifies it
- [ ] If the spec is ambiguous, stop and escalate back to the spec writer (via the orchestrator) rather than inventing an answer
- [ ] **PAUSE for user approval.** Present BOTH `plan.aide` and the updated `brief.aide` and do not proceed until the user approves them. Iterate if the user requests changes
- [ ] Hand the approved plan + brief to the implementor via `/aide:build`
