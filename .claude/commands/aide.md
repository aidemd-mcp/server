# /aide — Orchestrator

Conversational entry point for the full AIDE pipeline. Interviews the user, then drives each phase as an independent agent session — spinning up fresh context for every stage and handing off via files.

## Resume Protocol

Before starting, detect the current state of the target module by checking which files exist. The file state IS the pipeline state:

| State detected | Resume from |
|----------------|-------------|
| No `.aide` in target module | **Interview** — start from scratch |
| `.aide` exists with frontmatter only (no body sections) | **Research** or **Synthesize** — check if brain has research |
| `.aide` exists with body sections filled | **Plan** — spec is complete |
| `plan.aide` exists with unchecked items | **Build** — plan is ready |
| `plan.aide` fully checked, no `todo.aide` | **QA** — build is done |
| `todo.aide` exists with unchecked items | **Fix** — QA found issues |
| `todo.aide` fully checked | **Done** — promote retro to brain, report completion |

Use `aide_discover` to walk the `.aide` chain and understand the intent tree before making any resume decisions.

## Pipeline

### Stage 1: Interview → `aide:spec`

Interview the user to understand what they want to build. Ask about:
- What is the module for? Who consumes its output?
- What does success look like? What does failure look like?
- Any domain knowledge already available? (Skip research if so)

Delegate to the `aide-spec-writer` agent to write the `.aide` frontmatter only:
- `scope`, `intent`, `outcomes.desired`, `outcomes.undesired`
- No body sections — those come from the Domain Expert after research

Present the frontmatter to the user for confirmation before proceeding.

### Stage 2: Research → `aide:research`

Delegate to the `aide-researcher` agent (fresh context) to fill the brain with domain knowledge.

- Agent searches web, vault, MCP memory for relevant domain sources
- Persists findings to the brain filed by **domain** (e.g., `research/email-marketing/`), not by project
- Skip this stage if the user confirms domain knowledge already exists in the brain

### Stage 3: Synthesize → `aide:synthesize`

Delegate to the `aide-domain-expert` agent (fresh context) to complete the `.aide` body.

- Agent uses `aide_discover` to understand the intent tree
- Reads the `.aide` frontmatter for intent
- Reads the brain's research notes for domain knowledge
- Fills: `## Context`, `## Strategy`, `## Good examples`, `## Bad examples`

Present the completed spec to the user for review before proceeding.

### Stage 4: Plan → `aide:plan`

Delegate to the `aide-architect` agent (fresh context) to produce the implementation plan.

- Agent reads the complete `.aide` spec
- Pulls the coding playbook from the brain
- Scans the codebase for existing patterns and helpers
- Writes `plan.aide` next to the `.aide` — checkboxed steps, decisions documented

**PAUSE for user approval.** Do not proceed to build until the user approves the plan. The user may request changes — iterate on the plan until approved.

### Stage 5: Build → `aide:build`

Delegate to the `aide-implementor` agent (fresh context) to execute the plan.

- Agent reads `plan.aide` and the `.aide` spec
- Executes steps top-to-bottom, checking boxes as they complete
- Writes code and tests, runs until green

### Stage 6: QA → `aide:qa`

Delegate to the `aide-qa` agent (fresh context) to verify output against intent.

- Agent uses `aide_discover` to walk the full `.aide` chain
- Compares actual output against `outcomes.desired`
- Checks for `outcomes.undesired` violations
- Produces `todo.aide` with issues, misalignment tags, and retro

If no issues found, skip to completion.

### Stage 7: Fix loop → `aide:fix`

For each unchecked item in `todo.aide`:
- Delegate to the `aide-implementor` agent (fresh context) to fix exactly ONE item
- After fix, delegate to the `aide-qa` agent (fresh context) to re-validate

Repeat until `todo.aide` is clear or a new `todo.aide` replaces it.

### Completion

When all issues are resolved:
- Promote retro findings from `todo.aide` to the brain at `process/retro/`
- Report completion to the user with a summary of what was built

## Rules

- **Every stage gets fresh context.** No agent carries conversation from a prior stage. Handoff is via files only: `.aide`, `plan.aide`, `todo.aide`, brain notes.
- **Use `aide_discover` liberally.** The orchestrator and every agent that reads intent must walk the `.aide` chain to understand the full intent tree.
- **Pause for approval twice:** after spec frontmatter (Stage 1) and after plan (Stage 4). These are the two points where the user's input shapes the work.
- **Detect and resume.** If the user runs `/aide` mid-pipeline, detect state from existing files and resume from the correct stage. Never restart from scratch if prior work exists.
- **Research is filed by domain.** Brain notes go to `research/<domain>/`, not `research/<project>/`. The knowledge is reusable across projects.
- **Retro is promoted.** When the fix loop closes, extract the `## Retro` section and persist it to `process/retro/` in the brain. This is how the pipeline learns.
