const METHODOLOGY_MARKER = "<!-- aide-methodology -->";

/**
 * Return the AIDE methodology text wrapped with idempotency markers.
 * Content is derived from the AIDE spec-documents standard, written as
 * agent instructions that teach the convention inline.
 */
export function getMethodology(): string {
	return `
${METHODOLOGY_MARKER}
## AIDE — Autonomous Intel-Driven Engineering

This project uses **.aide spec files** alongside code. They capture intent,
research, and QA checklists that the code alone doesn't express. Read them
before reading code — they are the context layer between folder structure
and implementation.

### File Types

| File | Purpose |
|------|---------|
| \`.aide\` | Intent spec (default). Strategy, contracts, anti-patterns, worked examples. |
| \`intent.aide\` | Same as \`.aide\` — used only when \`research.aide\` exists in the same folder. |
| \`research.aide\` | Raw research. Sources, data points, pattern synthesis. |
| \`todo.aide\` | QA checklist. Issues found by audit agents, one checkbox per fix. |

**Rule:** never have both \`.aide\` and \`intent.aide\` in the same folder.

### Progressive Disclosure

1. **Folder structure** — the tree is the architecture. Read it first.
2. **\`.aide\` files** — read these before opening code. They explain why, not what.
3. **Orchestrator imports + JSDoc** — understand the data flow.
4. **Function bodies** — drill in only where the task demands it.

### Where \`.aide\` Files Live

Next to orchestrator \`index.ts\` files — never next to helpers. If a folder
coordinates a pipeline, it can have \`.aide\` files. If a folder contains a
single-purpose helper, it doesn't.

### Writing Standards

- Specs are contracts, not essays. Every section must be actionable.
- Include data with attribution, not vague claims.
- Type contracts when applicable — the implementer derives signatures from the spec.
- Anti-patterns prevent common mistakes. Worked examples eliminate ambiguity.
- Each \`.aide\` must stand alone — a reader understands it without reading other specs.

### The Agent Pipeline

1. **Research** — ingest sources, synthesize patterns, write \`research.aide\`
2. **Spec** — distill research into intent spec (\`.aide\` or \`intent.aide\`)
3. **Build** — read the intent spec, implement, write tests, run until green
4. **QA** — compare output against spec, produce \`todo.aide\` checklist
5. **Fix** — one issue per session, verify no regressions, check the box

### MCP Tools

Use \`aide_discover\` to see the project's spec tree. Use \`aide_read\` to drill
into a specific spec. Use \`aide_scaffold\` to create new specs with correct
naming. Use \`aide_validate\` to health-check specs.

### Slash Commands

Use the AIDE slash commands for each pipeline phase:
- \`/aide-research\` — research a domain and write \`research.aide\`
- \`/aide-spec\` — write the intent spec from research
- \`/aide-build\` — implement from the intent spec
- \`/aide-qa\` — audit implementation against the spec
- \`/aide-fix\` — fix one QA issue at a time
${METHODOLOGY_MARKER}
`.trim();
}

/** Return the idempotency marker used to detect existing methodology. */
export function getMethodologyMarker(): string {
	return METHODOLOGY_MARKER;
}

/**
 * Return slash command templates as a map of filename → content.
 * Each command is a checklist the agent follows for that pipeline phase.
 */
export function getCommands(): Record<string, string> {
	return {
		"aide-research.md": `# /aide-research — Research Phase

Research a domain or feature and produce a \`research.aide\` file.

## Checklist

- [ ] Identify the domain/feature being researched
- [ ] Search for existing research: vault notes, transcripts, external sources
- [ ] Synthesize findings into a \`research.aide\` file next to the target module
- [ ] Include in the research file:
  - Sources with ratings and dates
  - Data points with attribution
  - Patterns table (cross-source synthesis)
  - Conflicts resolved (where sources disagreed, which direction chosen)
- [ ] If a \`.aide\` already exists in the target folder, rename it to \`intent.aide\`
- [ ] Run \`aide_validate\` to check for spec issues
`,

		"aide-spec.md": `# /aide-spec — Spec Phase

Write the intent spec from research findings.

## Checklist

- [ ] Read the \`research.aide\` if one exists in the target folder
- [ ] Write the intent spec:
  - Use \`.aide\` if no \`research.aide\` exists
  - Use \`intent.aide\` if \`research.aide\` exists
- [ ] Include in the spec:
  - Strategy: high-level flow, key decisions and why
  - Implementation contracts: TypeScript types, function signatures
  - Anti-patterns: what NOT to do
  - Worked examples: abstract rules plus concrete examples
- [ ] Every section must be actionable — if it doesn't help make a decision, cut it
- [ ] Spec must stand alone — a reader understands it without reading other specs
- [ ] Run \`aide_validate\` to check for spec issues
`,

		"aide-build.md": `# /aide-build — Build Phase

Implement from the intent spec.

## Checklist

- [ ] Read the intent spec (\`.aide\` or \`intent.aide\`) before touching code
- [ ] Follow the spec as the implementation contract
- [ ] The spec defines what "correct" means — not just passing tests
- [ ] Write tests covering happy path and edge cases from the spec
- [ ] Run tests until green
- [ ] Run type checker (\`tsc --noEmit\` or equivalent)
- [ ] Run \`aide_validate\` to check for spec issues
`,

		"aide-qa.md": `# /aide-qa — QA Phase

Audit implementation against the intent spec.

## Checklist

- [ ] Read the intent spec (\`.aide\` or \`intent.aide\`)
- [ ] Compare actual implementation output against the spec
- [ ] Check for hidden failures:
  - Things that pass tests but violate intent
  - Missing edge cases from the spec
  - Anti-patterns the spec warned against
- [ ] Produce a \`todo.aide\` checklist of issues found
- [ ] Each issue gets:
  - A checkbox
  - Description of the issue
  - Reference to which spec section it violates
- [ ] Use \`aide_scaffold\` with type \`todo\` if no \`todo.aide\` exists yet
`,

		"aide-fix.md": `# /aide-fix — Fix Phase

Fix one QA issue from the \`todo.aide\` checklist.

## Checklist

- [ ] Read the intent spec (\`.aide\` or \`intent.aide\`)
- [ ] Read \`todo.aide\` — pick the next unchecked item
- [ ] Fix ONE issue only (one fix per session)
- [ ] Run tests — verify no regressions
- [ ] Run type checker
- [ ] Check the box in \`todo.aide\`
- [ ] Commit the fix
`,
	};
}
