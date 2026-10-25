# Cascading Alignment

The AIDE intent tree is a hierarchy of `.aide` specs: root intent at the top, module specs below, submodule specs below those. Intent flows downward — each child spec narrows the intent of its parent. Without explicit verification, a child spec could contradict a parent's undesired outcomes and the drift would go unnoticed until QA fails in a confusing way — or worse, the implementation faithfully serves a child intent that violates the root intent. This is the **cascading alignment problem**: specs multiply and drift between levels can accumulate silently.

Cascading alignment is the protocol that detects and surfaces that drift. It separates **spec-vs-spec verification** from **code-vs-spec verification** (which is QA's job) and gives the spec-vs-spec job to a dedicated agent — the aligner.

## The Alignment Problem

Agents in the AIDE pipeline read specs and produce artifacts from them. The architect reads a spec and produces a plan. The implementor reads a plan and produces code. QA reads a spec and verifies code against it. None of these roles require that a spec be internally consistent with its ancestors — they all assume the spec is correct and work from it.

This assumption holds when spec authors rigorously check their work against every ancestor. It fails in practice: specs are written iteratively, outcomes change, new child specs are added without re-reading the full ancestor chain, and no one performs a systematic check. The result is that drift enters the spec tree undetected and persists until a downstream failure makes it visible.

Cascading alignment makes drift visible before code is written.

## The Aligner's Role

The aligner agent performs **spec-vs-spec comparison** — it checks whether a child spec's outcomes are consistent with every ancestor's outcomes. It does not check code. It does not propose fixes. It reads specs, identifies contradictions, and flags the spec that deviated.

**What the aligner checks.** At each child spec, the aligner compares the child's `outcomes.desired` and `outcomes.undesired` against every ancestor's outcomes, looking for:

- **Contradictions** — a child's desired outcome conflicts with an ancestor's undesired outcome, or vice versa
- **Undermining** — a child narrows its scope in a way that makes an ancestor's outcome unreachable within this branch of the tree
- **Omissions** — an ancestor has a critical outcome whose scope clearly covers this child, but the child doesn't acknowledge or carry it forward in any form

**What the aligner does not check.** Whether the implementation satisfies the spec — that is QA. The aligner never reads code. It reads specs only.

**Where the aligner flags drift.** Always at the leaf that deviated. If the root spec says "X is a failure mode" and a child spec says "X should always happen," the child is the one that drifted — the flag goes on the child, not the root. The ancestor remains the source of truth; the child carries the misalignment marker.

**What the aligner produces.** At each node where drift is found, the aligner moves the leaf spec's `alignment` to `misaligned` through `aide_frontmatter`, and produces a `todo.aide` with concrete items naming the specific conflict — which child outcome conflicts with which ancestor outcome, at which spec path. It never rewrites the spec's intent or outcomes. Realignment items go into `todo.aide` for a spec-writer to resolve.

## How the Aligner Walks the Tree

The aligner uses `aide_discover` on the target path to receive the full ancestor chain. It then walks top-down:

1. Load intent and outcomes for each spec in the chain, from root to target
2. At each child, compare its outcomes against every ancestor's outcomes accumulated so far
3. When drift is found: move the leaf's `alignment` to `misaligned` with `aide_frontmatter`, and produce `todo.aide` at the leaf with items referencing the specific conflict by outcome index and ancestor path
4. When no drift is found at a node: move that spec's `alignment` to `aligned` with `aide_frontmatter`
5. Continue down the chain until the target spec is reached

The aligner is invoked via `/aide:align` and reports a verdict (ALIGNED or MISALIGNED), the count of specs checked, the count of misalignments found, and the paths of any `todo.aide` files created.

## The `alignment` Field Lifecycle

The `alignment` field in a spec's frontmatter reflects whether alignment has been verified. It is always present and has three values. It is changed only through `aide_frontmatter`, never by hand.

| Value | Set By | Meaning |
|-------|--------|---------|
| `unreviewed` | Scaffold (new specs); the spec-writer or strategist after editing a spec | Alignment has not been checked since the spec last changed |
| `aligned` | Aligner only | A deliberate full-tree walk found no drift at this node |
| `misaligned` | Aligner, or QA incidentally | Drift detected — see `todo.aide` for specifics |

**`unreviewed` is the starting value.** A new spec starts `unreviewed`, and any edit to a spec's frontmatter or body moves it back to `unreviewed`, because an earlier `aligned` was a claim about the earlier text. `unreviewed` does not mean the spec is wrong — it means it has not been verified as it stands now. Older specs may still record the same values under the earlier `status` name; every reader treats that as the spec's alignment, and `aide_frontmatter` renames it on the next write.

**Aligned requires a deliberate full-tree walk.** Only the aligner sets `aligned`, and only after walking the full ancestor chain from root to the target node. An agent that reads a spec and judges it "looks fine" cannot set `aligned` — that is not the same as a systematic comparison against every ancestor's outcomes. The distinction matters because `aligned` carries a specific claim: every ancestor's outcomes were checked, not just the immediate parent's.

**Misaligned is set by the aligner or by QA incidentally.** QA reviews code against spec outcomes. While doing so, it may notice that the spec itself contradicts a parent spec — this is incidental to its primary job. QA can move the spec to `misaligned` when it observes this contradiction, but it cannot set `aligned`. QA never performs a full tree walk, so it cannot confirm that no drift exists — it can only flag drift it happens to notice.

**Alignment does not cascade.** When the aligner verifies a parent and sets `aligned`, that claim applies to the parent at the time of the check. If a new child spec is added later, the parent's alignment is not retroactively invalidated — the parent's outcomes didn't change. The new child starts `unreviewed`. The next `/aide:align` run checks the new child against its ancestors and sets its alignment accordingly.

## `todo.aide` for Alignment Issues

When the aligner finds drift, it produces a `todo.aide` at the misaligned leaf. The format follows the standard `todo.aide` spec with one alignment-specific constraint: the `misalignment` value is always `spec-gap`.

Alignment issues are definitionally spec-level problems — the spec itself contradicts an ancestor, not the implementation. `spec-gap` is the correct misalignment tag regardless of where in the pipeline the contradiction will eventually cause problems.

Each issue in the `todo.aide` names the specific conflict:

```markdown
## Issues

- [ ] **Leaf desired outcome #3 conflicts with root undesired outcome #2**
      Leaf says X should always happen; root spec at `.aide/intent.aide` names X as a failure mode.
      Traces to: `outcomes.desired[3]` | Misalignment: `spec-gap`
```

The issue tells a spec-writer exactly what to resolve without telling them how. The aligner never makes the revision itself — it flags and stops.

## Non-Blocking Semantics

`misaligned` is informational. It surfaces drift for human or agent judgment; it does not stop the pipeline.

A team may intentionally diverge a child spec from its parent. A child submodule may serve a constrained environment where a parent's desired outcome is not achievable, or where the parent's undesired outcome is intentionally accepted as a tradeoff. The aligner flags the divergence so it is visible — but the team decides whether to resolve it or document it as intentional.

If misalignment blocked the pipeline, intentional divergence would be impossible and every misalignment flag would create an emergency. The flag is a signal, not a gate.

## QA Interaction

QA and the aligner share the `alignment` field and the `todo.aide` file, but they interact with alignment differently:

**QA sets `misaligned` incidentally.** During code-vs-spec review, QA may notice that a spec it is validating against contradicts a parent spec. This is outside QA's primary scope but worth flagging. QA moves the spec to `misaligned` through `aide_frontmatter` and adds a `spec-gap` item to its `todo.aide`. It then continues its code-vs-spec review normally.

**QA never sets `aligned`.** QA reviews code against one spec at a time. It does not walk the full ancestor chain with the intention of confirming spec consistency. Setting `aligned` requires exactly that walk — a claim that every ancestor's outcomes were compared and no drift was found. QA cannot make that claim as a byproduct of code review.

**The aligner is the single source of `aligned` confirmations.** After a QA run sets `misaligned` and a spec-writer resolves the contradiction, the next `/aide:align` run performs the full tree walk and can confirm alignment. Until the aligner runs, the node remains `misaligned` even if the spec-writer believes the fix is complete.

## How Misalignment Is Resolved

The resolution flow is:

1. The aligner runs `/aide:align`, walks the tree, finds drift
2. The aligner moves the leaf to `misaligned` through `aide_frontmatter` and produces `todo.aide` with specific conflict items
3. A spec-writer (or the human) reads the `todo.aide`, understands which outcomes conflict, and revises the child spec to align with the ancestor — or documents the divergence as intentional in the spec's `## Context`. The revision moves the spec to `unreviewed`
4. `/aide:align` runs again on the same path, walks the tree, confirms no drift remains
5. The aligner moves the node to `aligned` through `aide_frontmatter`

The aligner never drives step 3. Realignment requires intent judgment — deciding whether to change the child's outcomes, change the ancestor's outcomes (a more consequential change), or accept the divergence as deliberate. That judgment belongs to the spec author, informed by the `todo.aide` the aligner produced.
