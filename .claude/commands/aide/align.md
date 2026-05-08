# /aide:align — Alignment Phase

> **Agent:** This command is executed by the `aide-aligner` agent.

Verify spec-vs-spec alignment and brevity across the intent tree. This is NOT QA — QA checks code against a spec; alignment checks whether specs are consistent with their ancestors *and* internally tight against the [Brevity Contract](../../../.aide/docs/aide-spec.md#brevity-contract). The aligner runs three passes per walk:

- **Cascade pass** — child outcomes vs. every ancestor's outcomes; flags contradictions, undermining, omissions
- **Brevity pass** — every spec measured against the caps (description ≤ 200 chars, intent ≤ 100 words, 3-4 outcomes per list with ≤ 2 sentences each, body sections under cap, no forbidden content)
- **Sibling-redundancy pass** — content duplicated across siblings under a common parent; that content belongs in the parent

The aligner produces `todo.aide` at every misaligned node with concrete items tagged by misalignment type. Cascade and sibling-redundancy use `Misalignment: spec-gap`; brevity uses `Misalignment: spec-bloat`. The aligner never rewrites specs — it flags only.

## Checklist

- [ ] Call `aide_discover` on the target path to get the full ancestor chain
- [ ] Read each spec in the ancestor chain top-down via `aide_read` — load description, intent, outcomes, and body sections at every level
- [ ] **Cascade pass:** compare each child's `outcomes.desired` and `outcomes.undesired` against every ancestor's outcomes — look for contradictions, undermining, and critical omissions. Tag findings `Misalignment: spec-gap`.
- [ ] **Brevity pass:** measure every spec against the Brevity Contract caps and scan for forbidden content (type signatures, file paths, exact strings, function names, argument indexes, implementation contracts, migration history). Tag findings `Misalignment: spec-bloat`.
- [ ] **Sibling-redundancy pass:** at every parent with multiple children specs, compare children's content for material that appears in two or more. Flag the children (not the parent) with `Misalignment: spec-gap`, naming the duplicated content and where it should live (parent).
- [ ] For misaligned specs: set `status: misaligned` on the leaf spec's frontmatter and produce `todo.aide` at the leaf with items from any pass that found drift
- [ ] For aligned specs (no drift across all three passes): set `status: aligned` on the spec's frontmatter
- [ ] Report results with verdict (ALIGNED/MISALIGNED), count of specs checked, total drift count broken down by pass (cascade / brevity / sibling-redundancy), and `todo.aide` paths created
- [ ] Recommended next step depends on the dominant category: cascade or sibling-redundancy → `/aide:spec` to revise the flagged specs; brevity → `/aide:refactor --specs <path>` for a batched cascade-aware sweep
- [ ] Do NOT rewrite specs — flag only
