# AIDE Template

> **For agents: this file is a scaffold, not a reference.** If you are creating a new `.aide` file, copy the fenced block in [The Template](#the-template) below verbatim into the new file, then replace every `<…>` placeholder with content specific to the module being specced. The prose under each body heading is *instructional guidance written for you* — overwrite it with real content as soon as you have it. Do not paraphrase this page into the new spec, and do not copy any text that lives *outside* the fenced block.

> **Brevity is load-bearing.** Read [Brevity Contract](./aide-spec.md#brevity-contract) before filling anything. The caps are hard, not aspirational: ≤ 200 chars for `description`, ≤ 100 words for `intent`, 3-6 outcomes per list with ≤ 2 sentences each, body sections kept tight, and the whole spec aiming at ~150 lines (a refactor signal kicks in around 175). A spec exceeding the caps means the scope is too wide — split into child specs, do not expand the spec. Implementation contracts (type signatures, file paths, argument indexes, schema cardinality, migration history, function-name enumerations) never appear in `.aide` files; they belong in code, `plan.aide`, `brief.aide`, or the brain. Domain vocabulary — entity names, status enums, field names that name a domain concept, domain enum values — is welcome and expected.

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
    # 3-6 items. Each ≤ 2 sentences. Falsifiable domain success criteria.
    # Outcomes name the *what*, not the *how*: implementation contracts (type
    # signatures, file paths, argument indexes, schema cardinality, function-name
    # enumerations) belong in code, plan.aide, brief.aide, or the brain — NEVER
    # here. Domain vocabulary (entity names, status enums, field names, domain
    # enum values) is welcome. YAML rule: if an item's text contains `: `
    # (colon-space), wrap the entire item in double quotes.
    - <One concrete, observable, falsifiable domain success criterion.>
    - <A second criterion, ≤ 2 sentences.>
    - <Additional criteria as needed up to 6 total.>
  undesired:
    # 3-6 items. Each ≤ 2 sentences. Especially the almost-right-but-wrong
    # outputs that pass tests. This is the tripwire list QA checks even when
    # everything else looks fine.
    - <A domain failure mode that violates intent — the kind a lazy or pattern-matching agent would produce.>
    - <A second failure mode, ≤ 2 sentences.>
    - <Additional failure modes as needed up to 6 total.>
---

<!--
  Body sections below are OPTIONAL. They exist only when the orchestrator
  routes through synthesize (the strategist agent fills them).

  - If the strategist will run: keep all five sections (Context, Strategy,
    Good examples, Bad examples, References) and fill them — partial bodies
    are not permitted.
  - If the orchestrator skips synthesize and goes straight to plan:
    DELETE the entire block from "## Context" through the closing markdown
    of "## References" inclusive. The frontmatter alone is a valid spec.

  See aide-spec.md "Body sections (conditional)" for the full rule.
-->

## Context

<!-- REPLACE THIS COMMENT with the Context body. Cap: ≤ ~250 words. Rules:
  - Explain why this module exists and the domain-level problem it solves.
  - Write for a strong generalist engineer who does not know this specific domain.
  - Do NOT restate context inherited from a parent `.aide` — children inherit.
  - Only domain-specific background. No type signatures, no file paths,
    no argument indexes. Domain vocabulary is welcome.
  - If this section keeps wanting to grow, the scope is too wide. Split the module.
  Delete this entire HTML comment once the real Context is written. -->

## Strategy

<!-- REPLACE THIS COMMENT with the Strategy body. Cap: ≤ ~7 decisions, each
  ≤ ~80 words. One paragraph per decision, decision form not description form.
  Rules:
  - Each paragraph states a concrete choice (tactic, threshold, structural
    decision, sequencing rule) and the reasoning or data that justifies it.
  - "Do X because Y (citation)" — never "X is a thing that exists."
  - Cite sources inline, compressed: name the source and the finding, move on.
  - No type signatures, no file paths, no argument indexes, no schema-cardinality
    contracts, no worked code examples. The section should survive a rewrite of
    the implementation. Domain vocabulary (entity names, status enums, field
    names, domain enum values) is welcome.
  - If you have more than ~7 decisions, the scope is too wide — split the module.
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
