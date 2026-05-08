# /aide:synthesize — Synthesize Phase

> **Agent:** This command is executed by the `aide-strategist` agent.

Read the intent spec's frontmatter and the brain's research, then fill in the `.aide` body sections (Context, Strategy, Good examples, Bad examples, References) AND author the sibling `brief.aide`. This is a fresh strategist session — it did not run the research phase and carries no prior context.

**Synthesize is conditional in the AIDE pipeline.** It runs only when the orchestrator routes through this phase — either because the spec-writer signaled "Strategy needed" or the user explicitly asked for synthesis. Most modules skip synthesize and go straight to `/aide:plan` as frontmatter-only navigation stubs.

**All-or-nothing rule:** if you produce a body, you fill all five sections. Partial bodies (Context filled but Strategy empty, etc.) are forbidden. If the available research isn't sufficient to fill all five, escalate back to `/aide:research` rather than producing a thin body.

## Checklist

- [ ] Read the target `.aide` file. Confirm frontmatter is complete (scope, intent, outcomes.desired, outcomes.undesired). If frontmatter is missing or incomplete, stop and escalate back to `/aide:spec`
- [ ] Identify the domain from the intent. Search the brain for research filed under that domain (e.g., `research/email-marketing/`, `research/local-seo/`)
- [ ] If no brain is available, check for a co-located `research.aide` in the same folder as the intent spec
- [ ] If neither brain research nor `research.aide` exists, stop — research must run first via `/aide:research`
- [ ] Read all relevant research entries. Cross-reference findings against the intent's `outcomes.desired` and `outcomes.undesired` — the research serves the intent, not the other way around
- [ ] Fill `## Context` — why this module exists, the domain-level problem, constraints that shape it. Write for a generalist engineer. No code. Do not restate context already carried by a parent `.aide`
- [ ] Fill `## Strategy` — distill research into decisions. Each paragraph names a concrete choice (tactic, threshold, structural decision) and the reasoning or data that justifies it. Cite sources inline. Write in decision form, not description form. No code
- [ ] Fill `## Good examples` — concrete domain output that illustrates success. Real output, not code. Pattern material for QA
- [ ] Fill `## Bad examples` — the almost-right failures. Output that looks valid but violates intent. Recognizable failure modes, not enumeration
- [ ] Verify every strategy decision traces back to an `outcomes.desired` or guards against an `outcomes.undesired`. Cut anything that doesn't serve the intent
- [ ] Run `aide_validate` to check the completed spec for structural issues
- [ ] Hand off to `/aide:plan` — the architect is the next phase
