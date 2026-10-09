/**
 * Seed text for the Move guide at `kanban/guide/move.md`, carried by the
 * template's `kanban-move` contract section.
 *
 * Obsidian-specific by design: wiki links and the `mcp__brain__*` tools.
 * Moving a card is moving one file between its project's column folders.
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

Part of [[kanban/kanban|Kanban]]. Read it first: its project, column, card and brain tool rules apply to every step below.

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

If no card can be identified, tell the user and stop.

## Step 3 — Determine the project

Get the project tag (see Project in [[kanban/kanban|Kanban]]).

## Step 4 — Find the card

Look for \`<slug>.md\` in the project's column folders under \`kanban/<project>/\`. If it is not found, tell the user and stop. If it is already in the target column, tell the user and stop.

## Step 5 — Move the card

Move the file to \`kanban/<project>/<target column folder>/<slug>.md\` and update its \`updated\` field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).

## Step 6 — Confirm

Tell the user: "\`<slug>\` moved to <Target Column>."
`;
