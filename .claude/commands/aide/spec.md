# /aide:spec — Spec Phase

> **Agent:** This command is executed by the `aide-spec-writer` agent.

Produce the `.aide` intent spec **frontmatter only**. This is the spec-writing phase — the session that distills the orchestrator's delegation context into a falsifiable intent contract. The orchestrator owns the user conversation and passes the gathered context in the delegation prompt. Body sections (Context, Strategy, Good/Bad examples, References) are **conditional** — they exist only when the orchestrator routes through `/aide:synthesize` afterwards. Most modules are navigation stubs and skip synthesize entirely, going straight to `/aide:plan`. Signal whether synthesize is needed in your return.

## Checklist

- [ ] Read the delegation context from the orchestrator. If insufficient to write specific outcomes (missing: what the module is for, who consumes its output, what success looks like, what failure looks like), return to the orchestrator listing what's missing
- [ ] Read the AIDE template before writing — copy the fenced template block from the canonical template doc into the new file
- [ ] Decide filename:
  - Use `.aide` if no `research.aide` exists in the target folder
  - Use `intent.aide` if `research.aide` exists in the same folder (co-located research is an escape hatch — prefer the brain)
- [ ] Fill the frontmatter ONLY against hard caps:
  - `scope` — the module path this spec governs
  - `description` — one sentence, ≤ 200 characters
  - `intent` — one paragraph, ≤ 100 words, ten-second north star
  - `outcomes.desired` — 3-6 items, ≤ 2 sentences each, falsifiable
  - `outcomes.undesired` — 3-6 items, ≤ 2 sentences each, the almost-right-but-wrong kind
- [ ] **Body sections are conditional.** Default: produce a frontmatter-only file with NO body section headings. If the orchestrator's delegation prompt explicitly says synthesize will run, then preserve empty body section placeholders for the strategist; otherwise omit them entirely.
- [ ] No code in the spec — no file paths, no type signatures, no function names, no argument indexes. Domain vocabulary IS allowed (entity names, status enums, field names that name a domain concept).
- [ ] Every `outcomes` entry must trace back to the `intent` paragraph. Cut any outcome that doesn't
- [ ] Present the frontmatter to the orchestrator for relay to the user
- [ ] Run `aide_validate` to check the spec for structural issues
- [ ] Return **two routing signals** to the orchestrator: `Research needed: yes/no` and `Strategy needed: yes/no`. Default both to NO unless the interview surfaces genuine domain complexity. The orchestrator decides next stage:
  - both NO → `/aide:plan` directly (orchestrator passes user implementation context)
  - Strategy YES, Research NO → `/aide:synthesize` (brain already has research)
  - both YES → `/aide:research` first, then `/aide:synthesize`, then `/aide:plan`
