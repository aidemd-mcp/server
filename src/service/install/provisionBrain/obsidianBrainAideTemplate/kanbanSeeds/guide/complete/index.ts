/**
 * Seed text for the Complete guide at `kanban/guide/complete.md`, carried by
 * the template's `kanban-complete` contract section.
 *
 * Obsidian-specific by design: wiki links and the `mcp__brain__*` tools.
 * Completing a task is moving one file to its project's In Review or Done
 * folder.
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

Part of [[kanban/kanban|Kanban]]. Read it first: its project, column, task and brain tool rules apply to every step below.

Move the current session's task to In Review (the default) or to Done (when the user passes \`--done\` or asks for Done).

## Step 1 — Parse flags

Check whether \`--done\` was passed.

- No flag (default): the target column is **In Review**.
- \`--done\`: the target column is **Done**.

## Step 2 — Identify the task from session context

Look back through the current conversation for the task that was worked on this session. Signals: a task picked through Work, a task moved to In Progress through Manage, or a task file read or referenced during the session.

If no task was worked on this session, tell the user there is nothing to complete and stop.

## Step 3 — Determine the project

Get the project tag (see Project in [[kanban/kanban|Kanban]]).

## Step 4 — Find the task

Look for \`<slug>.md\` in the project's column folders under \`kanban/<project>/\`. It could be in any column. If it is not found, tell the user and stop.

## Step 5 — Move the task

Move the file to \`kanban/<project>/in-review/<slug>.md\` (or \`kanban/<project>/done/<slug>.md\` with \`--done\`) and update its \`updated\` field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).

## Step 6 — Confirm

Tell the user the task was moved to In Review (or to Done if \`--done\` was used).
`;
