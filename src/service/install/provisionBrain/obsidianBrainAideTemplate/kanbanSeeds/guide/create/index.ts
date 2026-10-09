/**
 * Seed text for the Create guide at `kanban/guide/create.md`, carried by the
 * template's `kanban-create` contract section.
 *
 * Obsidian-specific by design: it reproduces the `## Create` section of the
 * user's working kanban verbatim (wiki-link card slugs, `P# TYPE:` prefixes,
 * the `Related:` line, the `mcp__brain__*` tools), with headings promoted one
 * level outside fences and blockquotes, cross-file links pointing at the
 * kanban index, and one project-specific example generalized.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
---
# Create

Part of [[kanban/kanban|Kanban]]. Read it first: its board, card, project tag and brain tool rules apply to every step below.

Create a new card on the board.

## Delegation rules

1. Gather user input yourself and delegate everything else. You collect the card details by asking the user with structured options, then pass them to a single subagent call that does all the brain work. This keeps your context clean for whatever runs next.
2. Every subagent call needs three things: a type (\`general-purpose\`, because it needs write access), a short description for the UI, and the full prompt the subagent receives.
3. Ask the user with structured options for the priority and any other choice. Do not dump plain-text questions.

## Step 1 — Gather card details

Take whatever the user already provided (title, priority, \`--backlog\` flag).

- No title provided: ask "What's the task?"
- No priority provided: ask with these options:
  - \`p0\` — critical / blocks work
  - \`p1\` — high / should do soon
  - \`p2\` — low / nice to have
  - \`p3\` — lowest / cleanup, someday
- Title is vague: optionally ask for a short description. Skip this if the title is self-explanatory.
- If the user's request names a kind of work (a bug, a deploy, hardening, maintenance), take it as \`TYPE\`. Do not ask for it; without one, \`TYPE\` is none.

The target column is Backlog if \`--backlog\` was passed, Todo otherwise.

After this step you have \`TITLE\`, \`SEVERITY\`, \`TYPE\` (or none), \`DESCRIPTION\` (or none), \`TARGET_COLUMN\` and the project tag (see Project Tag in [[kanban/kanban|Kanban]]).

## Step 2 — Create the card

Make one subagent call (\`general-purpose\`, description "Create kanban task") with this prompt, filled in:

> You are creating a new card on the kanban board.
>
> **Task title:** \`<TITLE>\`
> **Severity:** \`<SEVERITY>\`
> **Type:** \`<TYPE or "none">\`
> **Description:** \`<DESCRIPTION or "none">\`
> **Target column:** \`<TARGET_COLUMN>\`
> **Project tag:** \`<project tag, or "none">\`
>
> Use only the brain read, write, move and search tools available in this session.
>
> ## Checklist
>
> - [ ] **Check the project tag.** If the project tag is "none", return \`MODE: NO_PROJECT\` and stop.
> - [ ] **Generate the slug.** Convert the title to a slug: lowercase, replace spaces and special characters with hyphens, strip leading and trailing hyphens, at most 60 characters. Check whether \`<target_folder>/<slug>.md\` already exists. If it does, append \`-2\` (or increment) until it is unique. Target folders: Todo is \`kanban/todo/\`, Backlog is \`kanban/backlog/\`.
> - [ ] **Find the project note.** List or search \`projects/\` for the note of the project this tag belongs to (for example tag \`myproject\` → \`projects/my-app\`). If exactly one note clearly matches, use it as \`<project-note>\` with its usual display name. If none or several match, omit the \`Related:\` line and report \`PROJECT_NOTE: none\`.
> - [ ] **Create the card.** Write \`<target_folder>/<slug>.md\`:
>
>   \`\`\`markdown
>   ---
>   tags:
>     - <project tag>
>     - <severity>
>     - <type in lower case, if not "none">
>   created: <YYYY-MM-DDTHH:MM:SS>
>   updated: <YYYY-MM-DDTHH:MM:SS>
>   ---
>
>   # <Task Title>
>
>   Related: [[projects/<project-note>|<display-name>]]
>
>   <Description if provided. Otherwise omit this line.>
>   \`\`\`
>
> - [ ] **Add to the board.** Read \`kanban/board.md\`. Insert a new line at the bottom of the target column section (just before the blank line(s) preceding the next \`##\` heading):
>
>   \`\`\`
>   - [ ] [[<slug>]] — <SEVERITY in upper case> <TYPE in upper case, if not "none">: <Task Title> #<project tag>
>   \`\`\`
>
>   For example \`- [ ] [[fix-login-bug]] — P1 BUG: Fix login bug on mobile #myproject\`, or \`- [ ] [[add-email-validation]] — P2: Add email validation #myproject\` without a type.
>
>   Write the full board back (overwrite), preserving everything above the first column heading and the trailing \`%% kanban:settings\` block.
> - [ ] **Return in this exact format:**
>
>   \`\`\`
>   CREATED:
>   SLUG: <slug>
>   PATH: <brain-relative path>
>   SEVERITY: <severity>
>   COLUMN: <target column>
>   PROJECT: <project tag or "unknown">
>   PROJECT_NOTE: <projects/<project-note> or "none">
>   \`\`\`
>
>   If no project tag was supplied: \`MODE: NO_PROJECT\`

Wait for the subagent result.

If the result is \`MODE: NO_PROJECT\`, ask the user "Which project is this task for?" Then re-run this step with the answer as the project tag.

## Step 3 — Confirm and clear

Tell the user: card created as \`<SLUG>\` (severity: \`<SEVERITY>\`) and added to \`<COLUMN>\`. One line. Then clear the context window (for example with \`/clear\`, where the harness supports it) so the next operation starts fresh.
`;
