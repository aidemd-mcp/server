# /aide:refactor — Refactor Phase

> **Agent:** This command is orchestrated by the `/aide` orchestrator, which delegates to the `aide-auditor` agent (one per `.aide` section) and then to `aide-implementor` agents for execution.

Audit existing code against the coding playbook and refactor to close convention drift. This is a post-QA phase — it runs on code that already works and already passed QA. The goal is conformance, not new functionality.

**This command requires a path argument.** It does NOT perform full-app refactoring in one pass. Scope it to a directory (e.g., `src/tools/score/`) and it will audit every `.aide`-defined section within that path.

## Flow

1. **Discover sections** — run `aide_discover` with the given path to find all `.aide` specs in the subtree
2. **Audit each section** — spawn one `aide-auditor` agent per `.aide` spec found. Each auditor:
   - Reads the implementation
   - Consults the coding playbook via `study-playbook`
   - Compares against progressive disclosure conventions
   - Produces `plan.aide` with refactoring steps
3. **Pause for approval** — present all plans to the user. Do not proceed until approved
4. **Execute refactoring** — for each approved `plan.aide`, delegate to `aide-implementor` agents (one per numbered step, same as build phase)
5. **Re-validate** — delegate to `aide-qa` per section to verify the refactoring didn't break spec conformance

## Checklist

- [ ] Require a path argument — refuse to run without one
- [ ] Run `aide_discover` scoped to the provided path
- [ ] For each `.aide` spec found, spawn one `aide-auditor` agent
- [ ] Collect all `plan.aide` outputs and present to user for review
- [ ] After approval, execute each plan using `aide-implementor` agents (one per numbered step)
- [ ] After all plans are executed, run `aide-qa` per section to verify spec outcomes still hold
- [ ] Report completion with a summary of drift items found, fixed, and verified
