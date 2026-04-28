# AIDE Template

> **For agents: this file is a scaffold, not a reference.** If you are creating a new `.aide` file, copy the fenced block in [The Template](#the-template) below verbatim into the new file, then replace every `<…>` placeholder with content specific to the module being specced. The prose under each body heading is *instructional guidance written for you* — overwrite it with real content as soon as you have it. Do not paraphrase this page into the new spec, and do not copy any text that lives *outside* the fenced block.

## How to use this template

1. Create the new `.aide` file at the correct location (next to the orchestrator `index.ts` it governs, or at `.aide/intent.aide` for the project root — see [placement rules](./aide-spec.md#where-aide-files-live)).
2. Copy the entire fenced block under [The Template](#the-template) into the new file, without the surrounding backticks.
3. Fill in the frontmatter: replace each `<…>` placeholder with a concrete value.
4. For each of the first four body sections (`## Context`, `## Strategy`, `## Good examples`, `## Bad examples`), read the guidance paragraph, then **replace it** with real content for this module. The guidance is a prompt for you — it does not belong in the finished spec. For `## References`, do not replace the guidance paragraph manually — the synthesis agent populates this section from its reading log during synthesis. If you are the synthesis agent, log every brain entry you actually used (path + one-line description of what you drew from it for the Strategy); discard entries you opened but did not use.
5. A finished `.aide` file contains zero `<…>` placeholders and zero guidance paragraphs from this template.

## The Template

````markdown
---
scope: <module path this spec governs, e.g. service/<module-name>. One spec, one scope.>
description: <one-line purpose statement — used by aide_discover ancestor chains so agents understand what this spec governs without opening it>
intent: >
  One paragraph, plain language, written so a human reading it cold understands
  the purpose of this module in under ten seconds. State the problem being solved
  and the conditions of success in terms of the consumer/user/recipient of the
  module's output — not in terms of the code that will implement it. This is the
  north star every other field must serve: every entry in "outcomes" below must
  be traceable back to this sentence. If the intent changes, the revision bumps
  and prior builds are invalidated.
outcomes:
  desired:
    - <One concrete, observable success criterion. Describe what the module's output must achieve for the intent to be satisfied. Keep it specific — every extra entry dilutes the intent, so aim for the minimum set that fully expresses success. 2-5 bullets is usually right. YAML rule: if any item's text contains a colon followed by a space (`: `), wrap the entire item in double quotes to prevent YAML parse errors.>
    - <Success criteria are what the QA agent compares actual output against. Write them so they are falsifiable: a reviewer should be able to look at a real output and say yes or no without hedging.>
    - <If a criterion has a measurable threshold (a rate, a count, a length), state it. If it's qualitative, state the quality in terms concrete enough to judge.>
  undesired:
    - <A failure mode that violates the intent. Especially important: the kind of output that looks correct on the surface and passes tests but misses the point. This is the tripwire list the QA agent checks even when everything else looks fine.>
    - <Call out the almost-right answers a lazy or pattern-matching agent would produce. If there's a phrase, shape, or shortcut that consistently signals failure in this domain, name it here.>
    - <Undesired outcomes are how intent survives green tests. Without this list, an agent will ship output that is technically valid and actually wrong.>
---

## Context

<!-- REPLACE THIS COMMENT with the Context body. Rules for what goes here:
  - Explain why this module exists and the domain-level problem it solves.
  - Write for a strong generalist engineer who does not know this specific domain.
  - Cover the constraints that shape the problem, the stakes of getting it wrong,
    and why a naive implementation would fail.
  - Do not restate context already carried by a parent `.aide`; child specs inherit.
  - Only include context specific to this module's scope.
  - No code, no filenames, no type signatures.
  Delete this entire HTML comment once the real Context is written. -->

## Strategy

<!-- REPLACE THIS COMMENT with the Strategy body. Rules for what goes here:
  - Describe how this module honors its `intent` and hits `outcomes.desired`
    without tripping `outcomes.undesired`.
  - Distill research (from the brain or an adjacent `research.aide`) into
    actionable decisions.
  - Write in decision form, not description form: each paragraph states a
    concrete choice (tactic, threshold, structural decision, sequencing rule)
    and the reasoning or data that justifies it.
  - An architect agent must be able to read this and know what to do AND why
    that approach beats the alternatives, so it can produce a plan the
    implementor can execute without further architectural decisions.
  - Cite sources inline, compressed: name the source, name the number or finding
    that matters, move on. No footnotes.
  - No code, no filenames, no type signatures, no function names, no worked
    code examples. If the implementation were rewritten from scratch this
    section should survive untouched.
  Delete this entire HTML comment once the real Strategy is written. -->

## Good examples

<!-- REPLACE THIS COMMENT with concrete domain examples of success for this
  module's output. Rules for what goes here:
  - Real domain output, not code. If the module produces text, show a passage
    that works. If it produces a structured record, show a record that is
    correct in spirit, not just in schema. If it produces a decision, show a
    correct one with enough context to see why it is correct.
  - Examples are pattern material for QA agents verifying output — pick ones
    that illustrate the intent, not the edge cases.
  Delete this entire HTML comment once the real examples are written. -->

## Bad examples

<!-- REPLACE THIS COMMENT with concrete domain examples of failure. Rules:
  - Show the almost-right answer: output that looks valid, passes tests, and
    still violates the intent.
  - Show the specific phrases, structures, or shortcuts that signal failure
    in this domain.
  - Each bad example must make it obvious WHY it is bad — either inline or
    by pairing it with the matching good example above.
  - The goal is recognizable failure modes, not an enumeration.
  Delete this entire HTML comment once the real examples are written. -->

## References

<!-- The synthesis agent populates this section during synthesis — do not fill
  it manually after the fact. Rules for what goes here:
  - Each entry is a bullet: the brain entry path, then ` -- `, then a one-line
    description of what was drawn from that entry for the Strategy.
  - Only entries that actually informed a strategy decision belong here.
    Entries the agent opened but did not use are excluded — padding the list
    destroys the signal between each reference and the decision it supports.
  - Descriptions are breadcrumbs: name the source and the specific finding or
    data point drawn from it. Do not restate the full finding; do not duplicate
    the Strategy.
  - Paths are hints, not contracts. Brain entries move; the description is the
    fallback. No tooling should validate reference paths, and no agent should
    treat a stale path as an error.
  Delete this entire HTML comment once the real references are written. -->
````
