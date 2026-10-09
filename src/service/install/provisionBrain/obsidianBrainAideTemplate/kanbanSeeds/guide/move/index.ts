/**
 * Seed text for the Move guide at `kanban/guide/move.md`, carried by the
 * template's `kanban-move` contract section.
 *
 * Obsidian-specific by design: it reproduces the `## Move` section of the
 * user's working kanban verbatim (wiki-link card slugs, the column folders,
 * the `%% kanban:settings` preservation rule), with headings promoted one
 * level outside fences and cross-file links pointing at the kanban index.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
---
# Move

Part of [[kanban/kanban|Kanban]]. Read it first: its board, card, project tag and brain tool rules apply to every step below.

Move the current session's card to a specified column. The card is inferred from the session. The user provides the target column inline (for example "move to todo", "move to in review").

## Step 1 — Parse the target column

Extract the target column from the request. Match it against the valid columns (case-insensitive):

- \`Backlog\`
- \`Todo\`
- \`In Progress\`
- \`In Review\`
- \`Done\`

If no target column is found in the message, ask: "Which column?"

## Step 2 — Identify the card from session context

Look back through the current conversation for the card being worked on this session. Signals, in priority order:

1. A card picked through Work and moved to In Progress.
2. A card moved through Manage during this session.
3. A card file read or referenced during the session.

Use the slug (the name on the board) and the current folder the card lives in.

If no card can be identified, tell the user and stop.

## Step 3 — Determine the project

Get the project tag (see Project Tag in [[kanban/kanban|Kanban]]).

## Step 4 — Read the board

Read \`kanban/board.md\`.

Locate the card's line on the board (the line containing \`[[<slug>]]\`). If it is not found, tell the user and stop.

If the card is already in the target column, tell the user and stop.

## Step 5 — Move the card

### 5a — Update the board

In the board content:

1. Remove the card line (the line containing \`[[<slug>]]\`) from its current column.
2. Insert it unchanged at the bottom of the target column (just before the blank line(s) that precede the next \`##\` heading, or, for Done, just before the blank line that precedes the \`%% kanban:settings\` block).
3. If the target is Done: change \`- [ ]\` to \`- [x]\`.
4. If moving out of Done: change \`- [x]\` back to \`- [ ]\`.

Write the full board back (overwrite), preserving everything above the first column heading and the trailing \`%% kanban:settings\` block.

### 5b — Move the card file

The card lives in the folder that matches its current column:

- \`kanban/backlog/\` — Backlog
- \`kanban/todo/\` — Todo
- \`kanban/in-progress/\` — In Progress
- \`kanban/in-review/\` — In Review
- \`kanban/done/\` — Done

If the source and target folders differ, move the file. Update the \`updated\` frontmatter field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).

## Step 6 — Confirm

Tell the user: "\`<slug>\` moved to <Target Column>."
`;
