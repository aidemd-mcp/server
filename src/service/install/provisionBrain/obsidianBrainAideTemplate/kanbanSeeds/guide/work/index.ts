/**
 * Seed text for the Work guide at `kanban/guide/work.md`, carried by the
 * template's `kanban-work` contract section.
 *
 * Obsidian-specific by design: wiki links and the `mcp__brain__*` tools. Card
 * reads and writes (find, activate) go to the `kanban-maintainer` agent, which
 * lists the project's column folders; the main agent investigates, plans,
 * implements and reviews.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
---
# Work

Part of [[kanban/kanban|Kanban]]. Read it first: its project, column, card and brain tool rules apply to every step below.

Pick, investigate and plan the project's next card, then implement, test and self-review it with strict plan/act mode discipline. Working a card moves it to In Progress and gates all code changes on the user's approval. Use this operation for each card you start. For other card operations use [[kanban/guide/manage|Manage]].

The caller may pass arguments, typically a card slug or a description fragment. They are honored in Step 1 to skip the picker. No arguments falls through to the interactive picker.

## Architecture

The \`kanban-maintainer\` agent handles card reads and writes (find, activate). It is stateless and disposable.

The main agent does the investigation, planning, implementation and review directly. This keeps accumulating context in the window so revisions do not pay double serialization costs.

Do NOT delegate investigation, implementation or review to subagents. Do NOT list the project's cards yourself; delegate that to \`kanban-maintainer\`. You may read a single card in full from the path it reports.

## Mode discipline

| Steps | Mode | Rule                                    |
| ----- | ---- | --------------------------------------- |
| 1–5   | Plan | Read, analyze, search. No code changes. |
| 5b    | Act  | Card activation write only.             |
| 6     | Act  | Write code, run type checks, run tests. |
| 7     | Plan | Read and analyze only. No code changes. |
| 8a    | Plan | Re-investigate, present revised plan.   |
| 8b    | Act  | Implement revised plan, run tests.      |
| 8c–8d | Plan | Re-review, present results.             |

**Transition rule:** After every Act section, re-enter planning mode before doing anything else. Do not make further code changes until explicitly approved.

## Checklist

- [ ] **Step 0** — Enter planning mode
- [ ] **Step 1** — Have \`kanban-maintainer\` find cards
- [ ] **Step 2** — Present the card table and ask the user to pick (skip if a slug matched)
- [ ] **Step 3** — (deferred — card activation runs at Step 5b after plan approval)
- [ ] **Step 4** — Investigate and plan (main agent, planning mode)
- [ ] **Step 5** — Hard stop: present the plan for approval
- [ ] **Step 5b** — Have \`kanban-maintainer\` activate the card (first act after approval)
- [ ] **Step 6** — Implement (main agent, act mode)
- [ ] **Step 7** — Review (main agent, planning mode)
- [ ] **Step 8** — Revision loop (if needed, forward-only)

## Step 0 — Enter planning mode

If you are not already in a read-only planning mode, enter it now. Do not proceed until you are in it.

## Step 1 — Find cards (\`kanban-maintainer\`)

Delegate to the \`kanban-maintainer\` agent with this request, filled in:

> You are finding a card in the project's kanban folders.
>
> **Arguments:** \`<args from the caller, or "none">\`
> **Project tag:** \`<project tag, or "none">\`
>
> Use only the brain read, search and frontmatter tools available in this session.
>
> ## Checklist
>
> - [ ] **Check the project tag.** If the project tag is "none", return \`MODE: NO_PROJECT\`.
> - [ ] **Find the card.**
>
>   **If the arguments contain a card name or slug:** look for it in the column folders under \`kanban/<project>/\`. A single match: read its full content and return it as DIRECT. Multiple matches: return all of them for clarification. No match: fall through to the listing.
>
>   **Otherwise:** list \`kanban/<project>/in-progress/\`, \`kanban/<project>/todo/\` and \`kanban/<project>/backlog/\`. Read each card's frontmatter for its priority (\`p0\`/\`p1\`/\`p2\`/\`p3\`, default \`p2\`) and its \`project\` field. If a card's \`project\` field is missing or does not match the folder, do NOT change it — collect it for the return output. Return as TABLE.
>
> - [ ] **Return** — one of:
>
>   **DIRECT** (the slug matched one card):
>
>   \`\`\`
>   MODE: DIRECT
>   PROJECT_TAG: <tag>
>   TASK_SLUG: <slug>
>   TASK_PATH: <brain-relative path>
>   TASK_CONTENT:
>   <full markdown including frontmatter>
>   \`\`\`
>
>   **TABLE** (the user picks):
>
>   \`\`\`
>   MODE: TABLE
>   PROJECT_TAG: <tag>
>
>   | # | Status | Severity | Task | Description |
>   |---|--------|----------|------|-------------|
>   | 1 | In Progress | p0 | slug | short desc |
>
>   TASK_PATHS:
>   1: kanban/<project>/backlog/my-task.md
>
>   TASK_CONTENTS:
>   --- TASK 1 ---
>   <full markdown>
>   \`\`\`
>
>   If any card has a missing or wrong \`project\` field, append:
>
>   \`\`\`
>   MISMATCHES:
>   - <slug>: project field is "<value or missing>" but the card is in "kanban/<project>/"
>   \`\`\`
>
>   Omit MISMATCHES if there are none.
>
>   **NO_TASKS** or **NO_PROJECT**: \`MODE: NO_TASKS\` / \`MODE: NO_PROJECT\`

## Step 2 — Present and pick

**First, check for mismatches.** If the response contains a \`MISMATCHES:\` section, present it:

> These cards have a missing or wrong project field:
> \`<list>\`
> Want me to fix them before continuing, or ignore for now?

**Hard stop.** If the user says fix, ask for each card: "Set the field to this folder's project, or move the card to the project its field names?" Then have \`kanban-maintainer\` apply the chosen fix. After fixing, **re-run Step 1**.

If the user says ignore, proceed.

**Then handle the mode:**

- \`NO_PROJECT\`: ask the user which project. Stop.
- \`NO_TASKS\`: tell the user there are no open cards. Stop.
- \`DIRECT\`: extract the card fields and skip to Step 4.
- \`TABLE\`: display the table verbatim. **Hard stop: "Which task?"** Accept a number, a slug or a description fragment.

## Step 3 — Deferred

Board activation is a write operation. It runs after plan approval, at Step 5b, to avoid planning-mode conflicts. The card path, slug and project tag resolved in Step 2 are used there.

## Step 4 — Investigate and plan (main agent, planning mode)

You do this directly, with no subagent. Planning mode: read, search and analyze only.

### 4a — Load conventions

Do not proceed to 4b until the conventions are fully loaded into this context window. Do not delegate planning to a subagent — it runs in a fresh context and will not have these conventions.

Try these sources in order and use the first that succeeds:

1. The \`study-playbook\` skill. Invoke it, then:
   - read the entry point it returns;
   - identify which sections are relevant to this task;
   - read each relevant section's entry point;
   - read every child file linked from those entry points;
   - only proceed to 4b once all the relevant child files are in context.
2. The project's \`CLAUDE.md\` in the working directory.
3. If neither exists, proceed without conventions and record \`CONVENTIONS: none found\`.

### 4b — Load context

Search the brain with the card's topic keywords for domain context.

### 4c — Investigate the codebase

- Read every file mentioned in the card (full files, not fragments).
- Search for all call sites of functions you expect to change.
- List every file that needs to change and why, including indirect dependents.

### 4d — Devise the plan

The plan must answer:

- **Root cause** (not symptom): quote specific lines or behavior.
- **Minimal change:** name each file, function or block, and what changes. If multiple approaches exist, list them and justify your choice.
- **Conventions used:** list which conventions from the coding playbook were used.
- **What could go wrong:** side effects, edge cases, anything needing user input.
- **Open questions:** anything ambiguous, or "None".

Output the plan as a structured checklist.

### 4e — Open questions (if any)

If there are open questions, **hard stop**. Present them to the user. Do not proceed until every question is answered or dismissed.

## Step 5 — Hard stop: present the plan

Present the plan to the user verbatim.

**Hard stop. Do not activate the card or write code until the user approves the plan.**

Once the user approves, proceed immediately to Step 5b, before writing any code.

## Step 5b — Activate the card (\`kanban-maintainer\`)

You are now in act mode. Delegate to the \`kanban-maintainer\` agent with this request, filled in:

> You are activating a card — stamping it and moving it to In Progress.
>
> **Card path:** \`<path>\` | **Slug:** \`<slug>\` | **Project:** \`<project tag>\` | **Now:** \`<YYYY-MM-DDTHH:MM:SS>\`
>
> Use only the brain read, write, move and frontmatter tools available in this session.
>
> ## Checklist
>
> - [ ] **Check the current status.** If the card path is already under \`kanban/<project>/in-progress/\`, this is a resume. Only stamp the session (append the datetime to \`sessions\`, update \`updated\`). Skip the move. Return \`DONE (resumed)\`.
> - [ ] **Stamp.** Read the frontmatter, then update it: append the current datetime to the \`sessions\` list (preserve existing entries) and update \`updated\`.
> - [ ] **Move the file.** Move the card to \`kanban/<project>/in-progress/<slug>.md\`.
> - [ ] Return \`DONE\` or \`DONE (resumed)\`.

Do not proceed to Step 6 until the agent returns \`DONE\` or \`DONE (resumed)\`.

## Step 6 — Implement (main agent, act mode)

You do this directly, with no subagent. Act mode: write code and run tools.

### 6a — Implement the changes

Follow the approved plan. Apply the coding playbook patterns loaded in Step 4a.

### 6b — Type check

Run the project's type checker. Fix all errors before proceeding.

### 6c — Write and run tests

**Mandatory.** Choose the appropriate test type:

- **Unit-testable changes** (functions, modules, classes): write a unit test that imports the actual function or module you changed. Do NOT copy-paste the implementation into the test. Cover the happy path at minimum, plus the edge cases from the plan.
- **Non-unit-testable changes** (config files, migrations, templates, CSS, build scripts, environment changes): write a smoke test or integration test that exercises the changed behavior end to end.
- **If neither is feasible** (pure documentation, environment-file changes, CI config): skip the test. State why no automated test applies and how to verify manually.

Run all tests and confirm green before proceeding.

**After implementation is complete and the tests pass, re-enter planning mode. Do not make any further code changes until explicitly approved.**

## Step 7 — Review (main agent, planning mode)

You are now in planning mode. Read and analyze only — no code changes.

### 7a — Get the diff

Run \`git diff HEAD\` for uncommitted changes. If it is empty, run \`git log --oneline -10\` to find the session commits, then \`git diff <first>^..HEAD\`.

### 7b — Read the changed files in full

For every file in the diff, read the complete current version (not just the hunks). Also read the callers and dependents of changed functions.

### 7c — Review against each criterion

- **Correctness:** does the implementation match the plan? Logic errors, missed conditions?
- **Edge cases:** boundaries, empty inputs, nulls, concurrent access?
- **Type safety:** complete types? Hidden \`any\` casts, missing null checks?
- **Error handling:** at the right level? Useful messages? Silent swallowing?
- **Side effects:** changes outside the stated scope? Shared-state impacts?
- **Test coverage:** do the tests verify the described behavior? Untested paths?
- **Playbook alignment:** follows the established patterns?
- **Performance:** N+1 queries, blocking calls, memory leaks?
- **Security:** injection, XSS, auth bypass, secrets in code?
- **Naming and clarity:** descriptive? Self-documenting?

### 7d — Produce the review

\`\`\`
VERDICT: LGTM | CHANGES_REQUESTED | NEEDS_DISCUSSION
RISK: Low | Medium | High

CRITICAL:
- <file:line> — <issue and fix>

WARNINGS:
- <file:line> — <issue and fix>

NITS:
- <file:line> — <suggestion>

POSITIVE:
- <things done well>

MISSED_EDGE_CASES:
- <scenario not covered>
\`\`\`

Omit sections with zero items.

### 7e — Present the review and check the verdict

Present the review to the user.

- **LGTM:** ask "Ready to stash?" If yes, run the [[kanban/guide/stash|Stash]] operation.
- **NEEDS_DISCUSSION:** hard stop. Wait for the user's direction. If the user says proceed, ask "Ready to stash?" If yes, run the [[kanban/guide/stash|Stash]] operation.
- **CHANGES_REQUESTED:** enter Step 8.

## Step 8 — Revision loop (forward-only)

Do not jump back to earlier steps. This is a self-contained loop. Repeat 8a–8d until the review verdict is LGTM or the user says stop.

### 8a — Re-investigate (planning mode)

Focus on the review's critical and warning findings, not a fresh investigation. Read any additional files needed to understand the issues. Devise a targeted revision plan addressing only the findings.

Present the revised plan. **Hard stop for approval.**

### 8b — Implement the revisions (act mode)

Implement only the approved revisions. Run the type check. Run the tests. Confirm green.

**After the tests pass, re-enter planning mode.**

### 8c — Re-review (planning mode)

Read and analyze only — no code changes.

Get the updated diff. Read the changed files in full. Review against the same criteria as Step 7c. Produce a new review in the same format as Step 7d.

### 8d — Present and check the verdict

Present the re-review to the user.

- **LGTM:** ask "Ready to stash?" If yes, run the [[kanban/guide/stash|Stash]] operation.
- **CHANGES_REQUESTED:** return to 8a.
- **NEEDS_DISCUSSION:** hard stop. Wait for the user's direction.
`;
