# /aide:synthesize — Synthesize Phase

> **Agent:** This command is executed by the `aide-strategist` agent.

Read the intent spec's frontmatter, the orchestrator's description of the pipeline flow and any brain research, then fill in the `.aide` body sections (Context, Strategy, Good examples, Bad examples, References) AND author the sibling `brief.aide`. This is a fresh strategist session — it did not run the research phase and carries no prior context.

**Synthesize is conditional in the AIDE pipeline.** It runs only when the orchestrator routes through this phase — either because the spec-writer signaled "Strategy needed" (the feature is a pipeline: several modules each doing one specific thing in a specific order, handing off through calls, events, a clock or state changes) or the user explicitly asked for synthesis. Self-contained modules skip synthesize and go straight to `/aide:plan` as frontmatter-only navigation stubs.

**All-or-nothing rule:** if you produce a body, you fill all five sections. Partial bodies (Context filled but Strategy empty, etc.) are forbidden. If the pipeline description and available research aren't sufficient to fill all five, escalate to the orchestrator (or back to `/aide:research` when domain knowledge is missing) rather than producing a thin body.

## Checklist

- [ ] Read the target `.aide` file. Confirm frontmatter is complete (scope, intent, outcomes.desired, outcomes.undesired). If frontmatter is missing or incomplete, stop and escalate back to `/aide:spec`
- [ ] Read the pipeline flow from the orchestrator's delegation: what starts it, the order of the steps, the hand-offs, what happens when a step is late, repeated or missing
- [ ] Identify the domain from the intent. Search the brain for any research filed under that domain (e.g., `research/email-marketing/`, `research/local-seo/`); if no brain is available, check for a co-located `research.aide`. A pipeline may have no research — its flow can come entirely from the delegation
- [ ] If there is neither a pipeline description nor research to work from, stop and escalate to the orchestrator
- [ ] Read all relevant research entries. Cross-reference findings against the intent's `outcomes.desired` and `outcomes.undesired` — the research serves the intent, not the other way around
- [ ] Fill `## Context` — why this module exists, the domain-level problem, constraints that shape it. Write for a generalist engineer. No code. Do not restate context already carried by a parent `.aide`
- [ ] Fill `## Strategy` — how the system solves its real-world problem: how the modules interact, and why: what starts the flow, who calls or notifies whom, in what order, what each hand-off carries, and what happens when one is late, repeated or missing. The parent spec carries the end-to-end flow; a module spec carries only its slice. Each paragraph names a concrete choice and the reasoning or data that justifies it, naming the outcome it serves. Never restate the intent or outcomes, recount history, or cite `session.aide`, `brief.aide`, `plan.aide` or `todo.aide`. Write in decision form, not description form. No code
- [ ] Fill `## Good examples` — concrete domain output that illustrates success. Real output, not code. Pattern material for QA
- [ ] Fill `## Bad examples` — the almost-right failures. Output that looks valid but violates intent. Recognizable failure modes, not enumeration
- [ ] Verify every strategy decision traces back to an `outcomes.desired` or guards against an `outcomes.undesired`. Cut anything that doesn't serve the intent
- [ ] Run `aide_validate` to check the completed spec for structural issues
- [ ] Hand off to `/aide:plan` — the architect is the next phase
