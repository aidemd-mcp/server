/**
 * Seed text for the Complete guide at `kanban/guide/complete.md`, carried by
 * the template's `kanban-complete` contract section.
 *
 * Obsidian-specific by design: it reproduces the `## Complete` section of the
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
# Complete

Part of [[kanban/kanban|Kanban]]. Read it first: its board, card, project tag and brain tool rules apply to every step below.

Move the current session's card to In Review (the default) or to Done (when the user passes \`--done\` or asks for Done).

## Step 1 — Parse flags

Check whether \`--done\` was passed.

- No flag (default): the target column is **In Review**.
- \`--done\`: the target column is **Done**.

## Step 2 — Identify the card from session context

Look back through the current conversation for the card that was worked on this session. Signals: a card picked through Work, a card moved to In Progress through Manage, or a card file read or referenced during the session.

If no card was worked on this session, tell the user there is nothing to complete and stop.

## Step 3 — Determine the project

Get the project tag (see Project Tag in [[kanban/kanban|Kanban]]).

## Step 4 — Read the board

Read \`kanban/board.md\`.

Locate the card's line on the board (the line containing \`[[<slug>]]\`). It could be in any column (Backlog, Todo, In Progress, In Review). If it is not found, tell the user and stop.

## Step 5 — Move the card

### 5a — Update the board

In the board content:

1. Remove the card line (the line containing \`[[<slug>]]\`) from its current column.
2. If the target is In Review: insert it at the bottom of the \`## In Review\` section (keep \`- [ ]\` and the line text unchanged).
3. If the target is Done: insert it at the bottom of the \`## Done\` section, just before the blank line that precedes the \`%% kanban:settings\` block, changing \`- [ ]\` to \`- [x]\`.

Write the full board back (overwrite), preserving everything above the first column heading and the trailing \`%% kanban:settings\` block.

### 5b — Move the card file

- If the target is Done: move the file from its current folder to \`kanban/done/<slug>.md\`.
- If the target is In Review: move the file from its current folder to \`kanban/in-review/<slug>.md\`.

Update the \`updated\` frontmatter field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).

## Step 6 — Confirm

Tell the user the card was moved to In Review (or to Done if \`--done\` was used).
`;
