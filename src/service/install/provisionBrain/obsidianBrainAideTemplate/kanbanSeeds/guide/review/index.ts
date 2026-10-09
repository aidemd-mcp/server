/**
 * Seed text for the Review guide at `kanban/guide/review.md`, carried by the
 * template's `kanban-review` contract section.
 *
 * Obsidian-specific by design: it reproduces the `## Review` section of the
 * user's working kanban verbatim (wiki-link card slugs, the subagent prompts,
 * the card's `## Review` and `## Revisions` entry formats), with headings
 * promoted one level outside fences and blockquotes. Every blockquoted prompt
 * line, including its `##`/`###`/`####` lines, is subagent prompt content and
 * stays unpromoted.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
---
# Review

Part of [[kanban/kanban|Kanban]]. Read it first: its board, card, project tag and brain tool rules apply to every step below.

Spin up a subagent to do a comprehensive code review of the changes made for the current session's card. If changes are requested, run the full investigate, plan, approve, implement cycle through subagents.

The point of this operation is to offload work from the main agent's context. Do as little as possible yourself and pass the context you already have to subagents. Do NOT read the card, search the brain or gather project context yourself.

## Delegation rules

1. Never read the card, diffs or code yourself. Every read operation happens inside a subagent call.
2. Execute the steps in strict order. Complete each step's subagent call and fully process its output before starting the next step.
3. Hard stops are mandatory. Where marked HARD STOP, you MUST stop and wait for user input.
4. Pass context forward explicitly. Each subagent call is stateless, so include all needed context (paths, slugs, diffs, review findings) in the prompt.
5. Every subagent call needs three things: a type (\`read-only\` for exploration, or \`general-purpose\` for full access), a short description for the UI (5–10 words), and the full prompt the subagent receives.
6. Planning mode must be off. If a read-only planning mode is active, turn it off before starting Step 1. This operation has its own approval gates, and planning mode adds redundant friction that breaks subagent write operations.
7. Ask with structured options at every HARD STOP. Whenever a HARD STOP presents the user with choices, ask with structured multiple-choice options. Do not dump plain text and wait. Only the main agent can ask the user.

## Step 1 — Run the review

You already know the card path, diff range and working directory from the current conversation. Pass them directly into the subagent prompt. If the user's request contains a commit range or branch, use that as the diff range.

If no card can be identified from conversation context, ask the user which card to review and **HARD STOP until they answer**.

Make one subagent call (type \`read-only\`, description "Code review for \`<TASK_SLUG>\`") with this prompt, filled in:

> You are performing a comprehensive code review.
> **You are read-only — do not write, patch, move or update any files or card content.**
>
> **Card path:** \`<path>\`
> **Diff range:** \`<range, or "uncommitted changes">\`
> **Working directory:** \`<pwd>\`
>
> ## MANDATORY FIRST STEP — do this before anything else
>
> Invoke the \`study-playbook\` skill and read everything it returns. Follow every convention it specifies when evaluating code. If the playbook references a project-level \`CLAUDE.md\`, read that too (check the working directory root). If the skill is unavailable, read the project's \`CLAUDE.md\`; if neither exists, proceed without conventions and say so in the review.
>
> ## Review checklist
>
> Follow this checklist in order:
>
> - [ ] **Read the coding playbook** (above — not optional, do it first).
> - [ ] **Gather context**
>   - Read the card at \`<card path>\`. Extract the description, investigation, plan, solution, stash and revisions sections.
>   - Get the diff: run \`git diff HEAD\` for uncommitted changes. If empty, run \`git log --oneline -20\` to find the session commits, then \`git diff <first-commit>^..HEAD\`. If a specific range was provided, use that.
>   - If the card contains a \`## Stash\` section, read the latest entry — it represents the most current session state (changes made, decisions, gotchas). Factor this into your review.
> - [ ] **Read the changed files in full.** For every file in the diff, read the complete current version (not just the diff hunks) so you have surrounding context. Also read the callers and dependents of changed functions.
> - [ ] **Review against each criterion:**
>   - **Correctness:** does the implementation match the plan and the card description? Logic errors, off-by-one, missed conditions?
>   - **Edge cases:** boundary conditions, empty inputs, null values, concurrent access, unexpected states?
>   - **Type safety:** correct and complete types? Any \`any\` casts, missing null checks at boundaries, type assertions hiding problems?
>   - **Error handling:** errors caught at the right level? Useful messages? Silent swallowing?
>   - **Side effects:** changes outside the stated scope? Check callers, dependents and shared state.
>   - **Test coverage:** do the tests verify the described behavior? Untested paths? Do the tests import the real module (not copy-pasted logic)?
>   - **Playbook alignment:** do the changes follow the established patterns from the coding playbook?
>   - **Performance:** N+1 queries, unnecessary re-renders, blocking calls, memory leaks?
>   - **Security:** OWASP top 10 — injection, XSS, auth bypass, secrets in code?
>   - **Naming and clarity:** descriptive names? Self-documenting code? Intent clear without comments?
> - [ ] **Produce the review** in this exact format:
>
> \`\`\`
> ## Review Summary
>
> **Verdict:** LGTM | Changes Requested | Needs Discussion
>
> **Risk level:** Low | Medium | High
>
> ### Findings
>
> #### Critical (must fix)
> - [ ] <file:line> — <issue and suggested fix>
>
> #### Warnings (should fix)
> - [ ] <file:line> — <issue and suggested fix>
>
> #### Nits (optional)
> - [ ] <file:line> — <suggestion>
>
> #### Positive
> - <things done well — reinforce good patterns>
>
> ### Missed Edge Cases
> - <scenario not covered by tests or code>
>
> ### Questions
> - <anything ambiguous that needs the author's input>
> \`\`\`
>
> Omit any section that has zero items. Every finding must reference a specific file and line number.

Wait for the subagent result. Then proceed to Step 2.

## Step 2 — Present the review

Display the full review output verbatim. Do not summarize, editorialize or filter.

## Step 3 — Record the review

Make one subagent call (\`general-purpose\`, description "Record review on \`<TASK_SLUG>\`") with this prompt, filled in:

> You are recording a code review on a card.
>
> **Card path:** \`<card path>\`
> **Now:** \`<YYYY-MM-DDTHH:MM:SS>\`
>
> Use only the brain read, append, write and frontmatter tools available in this session.
>
> - [ ] Read the current card.
> - [ ] If a \`## Review\` section already exists, append a new dated subsection under it (do NOT overwrite prior reviews). Otherwise, append a new \`## Review\` section.
> - [ ] Append:
>
> \`\`\`markdown
> ### <YYYY-MM-DD HH:MM>
>
> **Verdict:** <verdict>
> **Risk level:** <risk level>
>
> **Key findings:**
> <critical and warning items only — skip nits>
>
> **Action taken:** <pending user decision>
> \`\`\`
>
> - [ ] Update the frontmatter to set \`updated\`.
> - [ ] Return: \`DONE\`

Wait for \`DONE\`.

## Step 4 — Fix cycle (only if changes were requested)

If the verdict is **LGTM**, stop here. You are done.

If the verdict is **Changes Requested** or **Needs Discussion**, ask the user: "Want me to implement the fixes?"

**HARD STOP until they answer.**

If the user says yes, run Steps 4a through 4d below. You are an orchestrator: delegate every step to subagents.

### 4a — Investigate the findings

Make one subagent call (type \`read-only\`, description "Investigate review findings for \`<TASK_SLUG>\`") with this prompt, filled in:

> You are re-investigating a card after a code review found issues.
> **You are read-only — do NOT write, patch, move or update anything.**
>
> **Card path:** \`<path>\` | **Slug:** \`<TASK_SLUG>\` | **Project:** \`<project tag>\`
> **Working directory:** \`<pwd>\`
>
> Use only the brain read and search tools available in this session.
>
> ## MANDATORY FIRST STEP — do this before anything else
>
> Invoke the \`study-playbook\` skill and read everything it returns. Follow every convention it specifies. If the playbook references a project-level \`CLAUDE.md\`, read that too. If the skill is unavailable, read the project's \`CLAUDE.md\`; if neither exists, proceed without conventions and say so.
>
> ## Review findings to address
>
> \`<paste the full review findings: Critical + Warnings + Missed Edge Cases>\`
>
> ## Checklist
>
> - [ ] **Read the coding playbook** (above — not optional, do it first).
> - [ ] **Read the card.** Get full context, including investigation, plan, solution, stash and prior reviews.
> - [ ] **Investigate each finding.** Read every file referenced in the review findings (full files). Search for call sites of functions that need to change. Verify each finding is valid (not a false positive).
> - [ ] **Devise the fix plan.** For each confirmed finding:
>   - name the file, the function or block, and what changes;
>   - flag any side effects or downstream impacts;
>   - output as a **structured checklist**.
> - [ ] **Return in this exact format:**
>
>   \`\`\`
>   INVESTIGATION:
>   - **Validated findings:** <which review items are confirmed>
>   - **False positives:** <which items are not actually issues, with reasoning>
>   - **Files involved:** <each file + one-line reason>
>
>   OPEN_QUESTIONS:
>   <bulleted list, or "None">
>
>   PLAN:
>   <structured checklist of fixes>
>   \`\`\`

Wait for the subagent result. Parse out INVESTIGATION, OPEN_QUESTIONS and PLAN.

### 4b — Present the plan and handle open questions

If there are open questions, present them. **HARD STOP until every question is answered or dismissed.**

Present the PLAN verbatim.

**HARD STOP: "Plan ready — approve to proceed?"** Do not implement until approved.

### 4c — Implement the fixes

Once approved, make one subagent call (\`general-purpose\`, description "Implement review fixes for \`<TASK_SLUG>\`") with this prompt, filled in:

> You are implementing review fixes from an approved plan.
>
> **Card path:** \`<path>\` | **Slug:** \`<TASK_SLUG>\`
> **Working directory:** \`<pwd>\` | **Now:** \`<YYYY-MM-DDTHH:MM:SS>\`
>
> Use only the brain append and frontmatter tools available in this session.
>
> ## MANDATORY FIRST STEP — do this before writing any code
>
> Invoke the \`study-playbook\` skill and read everything it returns. Then check whether a \`CLAUDE.md\` exists at the working directory root — if so, read that too. Follow every convention from both for all code you write. If the skill is unavailable and there is no \`CLAUDE.md\`, proceed without conventions and say so.
>
> ## Approved plan
>
> \`<paste the full PLAN here>\`
>
> \`<if open questions were answered, paste them here under "## User answers">\`
>
> ## Checklist
>
> - [ ] **Read the coding playbook and the project \`CLAUDE.md\`** (above — mandatory).
> - [ ] **Implement the fixes.** Follow the approved plan step by step. Follow every convention from the playbook.
> - [ ] **Type check.** Run the project's type checker. Fix all errors before proceeding.
> - [ ] **Run tests.** Run the existing tests. If any review finding relates to untested behavior, add tests. All tests must pass before proceeding.
> - [ ] **Record revisions.** Append a \`## Revisions\` section to the card. If a \`## Revisions\` section already exists, append a new dated subsection (do NOT overwrite prior revisions):
>
>   \`\`\`markdown
>   ### <YYYY-MM-DD HH:MM>
>
>   **Review findings addressed:** <which items were fixed>
>   **Files changed:** <each file + one-line summary>
>   **Test coverage:** <tests added/modified and what they verify>
>   \`\`\`
>
>   Then update the frontmatter to set \`updated\`.
>
> - [ ] **Return in this exact format:**
>
>   \`\`\`
>   SUMMARY:
>   <files modified and what each change does>
>
>   TEST_RESULTS:
>   <tests added/modified, what they verify, pass/fail>
>
>   FILES_CHANGED:
>   <bulleted list of every file modified or created>
>   \`\`\`
>
> **Do NOT commit. No git add, git commit or any git write operations.**

Wait for the subagent result. Then proceed to Step 4d.

### 4d — Present results

Display \`SUMMARY\`, \`TEST_RESULTS\` and \`FILES_CHANGED\` verbatim.

**Do NOT commit or stage anything.** Wait for an explicit user request.

To review again, run the Review operation again.
`;
