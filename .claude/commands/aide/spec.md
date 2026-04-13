# /aide-spec — Spec Phase

> **Agent:** This command is executed by the `aide-spec-writer` agent.

Produce the `.aide` intent spec **frontmatter only**. This is the spec-writing phase — the session that distills the orchestrator's delegation context into a falsifiable intent contract. The orchestrator owns the user conversation and passes the gathered context in the delegation prompt. Body sections (Context, Strategy, examples) are filled later by the strategist in `/aide:synthesize` after research is complete.

## Checklist

- [ ] Read the delegation context from the orchestrator. If insufficient to write specific outcomes (missing: what the module is for, who consumes its output, what success looks like, what failure looks like), return to the orchestrator listing what's missing
- [ ] Read the AIDE template before writing — copy the fenced template block from the canonical template doc into the new file
- [ ] Decide filename:
  - Use `.aide` if no `research.aide` exists in the target folder
  - Use `intent.aide` if `research.aide` exists in the same folder (co-located research is an escape hatch — prefer the brain)
- [ ] Fill the frontmatter ONLY:
  - `scope` — the module path this spec governs
  - `intent` — one paragraph, plain language, ten-second north star
  - `outcomes.desired` — concrete, falsifiable success criteria
  - `outcomes.undesired` — failure modes, especially the almost-right-but-wrong kind
- [ ] Leave body sections (`## Context`, `## Strategy`, `## Good examples`, `## Bad examples`) as empty placeholders — the strategist fills these in `/aide:synthesize`
- [ ] No code in the spec — no file paths, no type signatures, no function names
- [ ] Every `outcomes` entry must trace back to the `intent` paragraph. Cut any outcome that doesn't
- [ ] Present the frontmatter to the orchestrator for relay to the user
- [ ] Run `aide_validate` to check the spec for structural issues
- [ ] Hand off to `/aide:research` if domain knowledge is needed, or `/aide:synthesize` if the brain already has sufficient research
