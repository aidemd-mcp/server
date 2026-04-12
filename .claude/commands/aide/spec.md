# /aide-spec — Spec Phase

Produce the `.aide` intent spec **frontmatter only**. This is the planner phase — the session that interviews the user and captures the intent contract. Body sections (Context, Strategy, examples) are filled later by the Domain Expert in `/aide:synthesize` after research is complete.

## Checklist

- [ ] Interview the user directly: what is the module for, who consumes its output, what does success look like, what does failure look like
- [ ] If a parent `.aide` exists up the tree, use `aide_discover` to walk the chain and understand inherited context before writing
- [ ] Read the AIDE template before writing — copy the fenced template block from the canonical template doc into the new file
- [ ] Decide filename:
  - Use `.aide` if no `research.aide` exists in the target folder
  - Use `intent.aide` if `research.aide` exists in the same folder (co-located research is an escape hatch — prefer the brain)
- [ ] Fill the frontmatter ONLY:
  - `scope` — the module path this spec governs
  - `intent` — one paragraph, plain language, ten-second north star
  - `outcomes.desired` — concrete, falsifiable success criteria
  - `outcomes.undesired` — failure modes, especially the almost-right-but-wrong kind
- [ ] Leave body sections (`## Context`, `## Strategy`, `## Good examples`, `## Bad examples`) as empty placeholders — the Domain Expert fills these in `/aide:synthesize`
- [ ] No code in the spec — no file paths, no type signatures, no function names
- [ ] Every `outcomes` entry must trace back to the `intent` paragraph. Cut any outcome that doesn't
- [ ] Present the frontmatter to the user for confirmation
- [ ] Run `aide_validate` to check the spec for structural issues
- [ ] Hand off to `/aide:research` if domain knowledge is needed, or `/aide:synthesize` if the brain already has sufficient research
