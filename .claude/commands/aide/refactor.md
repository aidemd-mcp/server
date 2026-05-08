# /aide:refactor — Refactor Phase

> **Agent:** This command is orchestrated by the `/aide` orchestrator. It has two modes selected by the `--specs` flag — code-drift refactor (default) and spec-bloat sweep (`--specs`). Each mode delegates to different agents and follows a different flow.

Refactor existing artifacts to close drift from canonical contracts. The two modes target different artifact classes and use different agents:

| Mode | Target | Drift detected against | Agents |
|---|---|---|---|
| Default | Source code | Coding playbook + progressive disclosure | `aide-auditor` → `aide-implementor` → `aide-qa` |
| `--specs` | `.aide` files | [Brevity Contract](../../../.aide/docs/aide-spec.md#brevity-contract) | `aide-aligner` → `aide-spec-writer` and/or `aide-strategist` → `aide-aligner` |

**This command requires a path argument.** It does NOT perform full-app refactoring in one pass. Scope it to a directory and it will audit every `.aide`-defined section within that path.

## Usage

```
/aide:refactor <path>             # code-drift refactor (default)
/aide:refactor --specs <path>     # spec-bloat sweep
```

---

## Mode 1 — Code-drift refactor (default)

Audit existing code against the coding playbook and refactor to close convention drift. This is a post-QA mode — it runs on code that already works and already passed QA. The goal is conformance, not new functionality.

### Flow

1. **Discover sections** — run `aide_discover` with the given path to find all `.aide` specs in the subtree
2. **Audit each section** — spawn one `aide-auditor` agent per `.aide` spec found. Each auditor:
   - Reads the implementation
   - Consults the coding playbook via `study-playbook`
   - Compares against progressive disclosure conventions
   - Produces `plan.aide` with refactoring steps
3. **Pause for approval** — present all plans to the user. Do not proceed until approved
4. **Execute refactoring** — for each approved `plan.aide`, delegate to `aide-implementor` agents (one per numbered step, same as build phase)
5. **Re-validate** — delegate to `aide-qa` per section to verify the refactoring didn't break spec conformance

### Checklist

- [ ] Require a path argument — refuse to run without one
- [ ] Run `aide_discover` scoped to the provided path
- [ ] For each `.aide` spec found, spawn one `aide-auditor` agent
- [ ] Collect all `plan.aide` outputs and present to user for review
- [ ] After approval, execute each plan using `aide-implementor` agents (one per numbered step)
- [ ] After all plans are executed, run `aide-qa` per section to verify spec outcomes still hold
- [ ] Report completion with a summary of drift items found, fixed, and verified

---

## Mode 2 — Spec-bloat sweep (`--specs`)

Audit `.aide` files against the [Brevity Contract](../../../.aide/docs/aide-spec.md#brevity-contract) and slim them in batched, cascade-aware passes. This is the canonical fix flow when the aligner reports `spec-bloat` items — instead of running `/aide:spec` or `/aide:synthesize` per bloated spec one at a time, this mode handles them as a single coordinated sweep.

The motivation: cascading prose refactors are prohibitively expensive when handled one spec at a time. A parent edit that invalidates content in N children should land as one orchestrated pass with all N rewrites reviewed together, not N separate sessions each costing a fresh tree walk.

### Flow

1. **Run the aligner** — delegate to `aide-aligner` scoped to the provided path. The aligner walks the tree top-down, executing all three passes (cascade, brevity, sibling-redundancy) and writing `todo.aide` files at every spec where drift is found. This step is mandatory even if a recent alignment already happened — bloat may have shifted since.

2. **Collect spec-bloat findings.** Read every `todo.aide` written or updated by step 1. For each, partition the items by which field is bloated:
   - **Frontmatter bloat** (`description`, `intent`, `outcomes.desired`, `outcomes.undesired` over caps or carrying forbidden content) → routes to `aide-spec-writer`
   - **Body bloat** (`## Context`, `## Strategy`, `## Good examples`, `## Bad examples` over caps) → routes to `aide-strategist`
   - **Sibling redundancy** flagged at children → routes the duplicated content up to the parent (rewrite the parent, slim the children)

3. **Spawn rewriter agents in parallel, one per bloated spec.** Each rewriter receives:
   - The current bloated spec (full content)
   - The ancestor chain (so it can prune content the parent already covers)
   - Sibling specs (so it can identify and lift sibling-shared content)
   - The relevant `todo.aide` items naming the specific bloat
   - The Brevity Contract caps (load-bearing — the rewriter must measure)

   Frontmatter rewriters use `aide-spec-writer`; body rewriters use `aide-strategist`. A single bloated spec may need both rewriters in sequence — frontmatter first, then body. When both are needed, run frontmatter first (its outcomes anchor the body), then body against the freshly-tightened frontmatter.

4. **Pause for batched diff review.** Present every rewrite as a before/after diff, grouped by spec. The user approves, rejects, or edits per spec. **Do not land any rewrite without explicit approval** — bloat removal is a judgment call about what content was load-bearing vs. ornamental, and the user is the authority on that.

5. **Land approved rewrites.** Apply approved diffs to the on-disk specs. Skip rejected ones — they stay bloated; the user accepts the bloat as intentional. Mark rejected `todo.aide` items as resolved-by-acceptance with a brief note in the file.

6. **Re-run the aligner.** A second alignment pass confirms which `spec-bloat` items cleared and surfaces any new drift the rewrites introduced (rare but possible — a tightened parent may now leave a child orphaned of context the child still needs).

7. **Report** — total `.aide` files audited, total bloat items found, items resolved per spec, items rejected as intentional, items remaining (if any), and the final aligner verdict.

### Cascade-awareness rule

When a parent spec is in the rewrite set, **rewrite the parent first**. Children's slim rewrites depend on what the parent now carries — a child that prunes content already covered by the parent must know what the parent will carry after the rewrite, not before. The orchestrator sequences rewriter agents top-down through the tree, not in parallel across depth levels, even though specs at the same depth can run in parallel.

### Checklist

- [ ] Require a path argument — refuse to run without one
- [ ] Run `aide-aligner` scoped to the provided path; collect all `todo.aide` files produced
- [ ] Partition `spec-bloat` items per spec by field (frontmatter vs. body) and per parent vs. children for sibling-redundancy
- [ ] Sequence rewrites top-down: parents before children, siblings in parallel within each depth
- [ ] For each spec needing frontmatter rewrite, spawn `aide-spec-writer` with the bloated frontmatter and the ancestor chain as delegation context
- [ ] For each spec needing body rewrite, spawn `aide-strategist` with the bloated body and the ancestor chain as delegation context
- [ ] Present every rewrite as a before/after diff, grouped by spec
- [ ] Pause for explicit user approval per spec — do not batch-approve silently
- [ ] Land approved rewrites; record rejections with one-line notes
- [ ] Re-run `aide-aligner` to confirm clearance and surface any new drift
- [ ] Report counts by category (frontmatter cleared / body cleared / rejected as intentional / remaining)

### What this mode does NOT do

- It does not run on code. Code drift is the default mode's responsibility.
- It does not invent new outcomes or rewrite intent. The intent is what the user approved at spec time; the rewriter compresses what's there, it does not change what the spec says.
- It does not delete `todo.aide` files. Those carry the audit trail. The aligner's next walk replaces them.
- It does not skip the diff review. Bloat-removal is a judgment call; user approval is mandatory per spec.
