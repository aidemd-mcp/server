# /aide-spec — Spec Phase

Produce the `.aide` intent spec. This is the planner phase — the session that turns either brain-resident research or direct user answers into the authoritative intent doc every downstream agent will work from.

## Checklist

- [ ] Identify which mode this session is running in:
  - **Brain mode** — a research agent has already filled the brain on this domain. Read the relevant brain notes first
  - **Interview mode** — no research exists. Interview the user directly: what is the module for, who consumes its output, what does success look like, what does failure look like
- [ ] Read the AIDE template before writing — copy the fenced template block from the canonical template doc into the new file
- [ ] Decide filename:
  - Use `.aide` if no `research.aide` exists in the target folder
  - Use `intent.aide` if `research.aide` exists in the same folder (co-located research is an escape hatch — prefer the brain)
- [ ] Fill the frontmatter: `scope`, `intent` (one paragraph, plain language, ten-second north star), `outcomes.desired`, `outcomes.undesired`
- [ ] Fill the four required body sections: `## Context`, `## Strategy`, `## Good examples`, `## Bad examples`
- [ ] Write strategy in decision form, not description form — each paragraph names a choice and the reasoning that justifies it. Cite data inline from the brain's research when applicable
- [ ] If a parent `.aide` exists up the tree, read it first and narrow this spec rather than restate the parent's purpose, invariants, or tripwires
- [ ] No code in the spec — no file paths, no type signatures, no function names, no worked code examples. The spec describes intent and strategy; implementation is the architect's and implementor's job
- [ ] Every `outcomes` entry must trace back to the `intent` paragraph. Cut any outcome that doesn't
- [ ] Run `aide_validate` to check the spec for structural issues
- [ ] Hand off to `/aide:plan` — the architect is the next phase
