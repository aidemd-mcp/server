# /aide:research — Research Phase (Optional)

> **Agent:** This command is executed by the `aide-domain-expert` agent.

Fill the brain with durable domain knowledge the synthesizer can later draw from. Run this phase only when the module requires domain expertise the team does not already have — skip it when the domain is already understood.

## Checklist

- [ ] Confirm research is actually needed. If the user or the brain already has the domain knowledge, stop and go directly to `/aide:synthesize`
- [ ] Identify the domain being researched — name it specifically enough that the brain can file the output under a stable topic
- [ ] Check the brain first for existing research on the topic. If coverage is already sufficient, stop — do not re-fetch what the brain already holds
- [ ] Gather sources: vault notes, transcripts, external articles, web search, MCP memory stores
- [ ] Synthesize findings and persist them to the brain **filed by domain** (e.g., `research/email-marketing/`, `research/local-seo/`), not by project. Domain knowledge is reusable across projects
- [ ] If no external brain is available, write findings to a co-located `research.aide` file next to the intent spec as a fallback. This is not ideal — recommend enabling an external memory store
- [ ] Each persisted note should include:
  - Sources with ratings and dates
  - Data points with attribution
  - Patterns observed across sources
  - Conflicts resolved (where sources disagreed, which direction chosen and why)
- [ ] Stop when coverage is sufficient for the synthesizer to fill the `.aide` body sections, not when all sources are exhausted
- [ ] Hand off to `/aide:synthesize` — the strategist (fresh session) will read your research and fill the spec's body sections
