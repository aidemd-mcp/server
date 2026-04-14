# /aide:align — Alignment Phase

> **Agent:** This command is executed by the `aide-aligner` agent.

Verify spec-vs-spec alignment across the intent tree. This is NOT QA — QA checks code against a spec; alignment checks whether a spec's outcomes are consistent with every ancestor spec's outcomes. When a child spec contradicts, undermines, or silently omits an ancestor outcome, the aligner detects the drift and produces a `todo.aide` at the misaligned node with concrete realignment items. It never rewrites spec outcomes — it flags only.

## Checklist

- [ ] Call `aide_discover` on the target path to get the full ancestor chain
- [ ] Read each spec in the ancestor chain top-down via `aide_read` — load intent and outcomes at every level
- [ ] Compare each child's `outcomes.desired` and `outcomes.undesired` against every ancestor's outcomes — look for contradictions, undermining, and critical omissions
- [ ] For misaligned specs: set `status: misaligned` on the leaf spec's frontmatter and produce `todo.aide` at the leaf with items naming the specific conflict (e.g., "Leaf desired outcome #N conflicts with ancestor [path] undesired outcome #M")
- [ ] For aligned specs: set `status: aligned` on the spec's frontmatter
- [ ] Report results with verdict (ALIGNED/MISALIGNED), count of specs checked, count of misalignments found, paths of any `todo.aide` files created, and recommended next step (`/aide:spec` to revise misaligned specs)
- [ ] Do NOT rewrite spec outcomes — flag only
