/**
 * Seed text for the Manage guide at `kanban/guide/manage.md`, carried by the
 * template's `kanban-manage` contract section.
 *
 * Obsidian-specific by design: it reproduces the `## Manage` section of the
 * user's working kanban verbatim (wiki-link card slugs, `P# TYPE:` prefixes,
 * the `%% kanban:settings` preservation rule, the column folders), with
 * headings promoted one level outside fences and cross-file links pointing at
 * the kanban index.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
---
# Manage

Part of [[kanban/kanban|Kanban]]. Read it first: its board, card, project tag and brain tool rules apply to every step below.

View and move cards on the board, scoped to the current project.

## Step 1 — Determine the project

Get the project tag (see Project Tag in [[kanban/kanban|Kanban]]).

## Step 2 — Read the board

Read \`kanban/board.md\`. Parse the content into the five columns: Backlog, Todo, In Progress, In Review, Done (ignore the trailing \`%% kanban:settings\` block). Filter each column to show only lines containing \`#<project tag>\`. From each line, take the slug from inside \`[[\` \`]]\` and the rest of the text after \` — \` (priority, type and summary).

### Reconciliation check

Before presenting cards, verify that each card's file location matches its board column. For every card line in the filtered results, check whether the file exists in the expected folder (\`kanban/backlog/\`, \`kanban/todo/\`, \`kanban/in-progress/\`, \`kanban/in-review/\`, \`kanban/done/\`). If a file is in the wrong folder (for example the board says In Review but the file is in \`kanban/in-progress/\`), silently move it to the folder its board column names. This handles drift caused by a board editor that updates the board but does not move files.

## Step 3 — Present cards and prompt for action

Display the filtered board to the user in a compact format:

\`\`\`
Backlog
  [ ] fix-login-bug — P1 BUG: Fix login bug on mobile
  [ ] add-email-validation — P2: Add email validation

Todo
  [ ] redesign-header — P2: Redesign the header

In Progress
  [ ] update-api — P1: Update the API endpoints

In Review
  [ ] update-docs — P3: Update the docs
\`\`\`

If all columns are empty for this project, tell the user and stop.

Then ask: "Which task do you want to move, and where?"

Accept natural answers such as:

- "move fix-login-bug to Todo"
- "move redesign-header to In Progress"
- "move update-docs to Done"

Valid column names: \`Backlog\`, \`Todo\`, \`In Progress\`, \`In Review\`, \`Done\`.

## Step 4 — Move the card

### 4a — Update the board

In the board content:

1. Remove the card's line (the line containing \`[[<slug>]]\`) from its current column.
2. Insert it unchanged at the bottom of the target column (just before the blank line(s) that precede the next \`##\` heading, or, for Done, just before the blank line that precedes the \`%% kanban:settings\` block).
3. If the target is Done: change \`- [ ]\` to \`- [x]\`.
4. If moving out of Done: change \`- [x]\` back to \`- [ ]\`.

Write the full board back (overwrite), preserving everything above the first column heading and the trailing \`%% kanban:settings\` block.

### 4b — Move the card file

The card lives in the folder that matches its current column:

- \`kanban/backlog/\` — Backlog
- \`kanban/todo/\` — Todo
- \`kanban/in-progress/\` — In Progress
- \`kanban/in-review/\` — In Review
- \`kanban/done/\` — Done

If the source and target folders differ, move the file. Update the \`updated\` frontmatter field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`). Do not update \`created\`.

## Step 5 — Confirm

Tell the user: "\`<slug>\` moved to <Target Column>."

Ask whether they want to move another card. If yes, return to Step 3. If no, stop.
`;
