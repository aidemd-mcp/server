# /aide-research — Research Phase (Optional)

Fill the brain with durable domain knowledge the planner can later draw from. Run this phase only when the module requires domain expertise the team does not already have — skip it when the domain is already understood.

## Checklist

- [ ] Confirm research is actually needed. If the user or the brain already has the domain knowledge, stop and go directly to `/aide:spec`
- [ ] Identify the domain being researched — name it specifically enough that the brain can file the output under a stable topic
- [ ] Check the brain first for existing research on the topic. If coverage is already sufficient, stop — do not re-fetch what the brain already holds
- [ ] Gather sources: vault notes, transcripts, external articles, web search, MCP memory stores
- [ ] Synthesize findings and persist them to the brain under the topic, not into the project repo. The brain is the only destination — the research phase never writes `.aide` files
- [ ] Each persisted note should include:
  - Sources with ratings and dates
  - Data points with attribution
  - Patterns observed across sources
  - Conflicts resolved (where sources disagreed, which direction chosen and why)
- [ ] Stop when coverage is sufficient for the planner to write intent, not when all sources are exhausted
- [ ] Hand off to `/aide:spec` — the planner is the next phase, and it will draw from the brain you just filled
