/**
 * Seed text for the Manage guide at `kanban/guide/manage.md`, carried by the
 * template's `kanban-manage` contract section.
 *
 * Obsidian-specific by design: wiki links and the `mcp__brain__*` tools.
 * The project's column folders are listed to show its cards, and the index's
 * cleanup rules are checked and offered to the user.
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

Part of [[kanban/kanban|Kanban]]. Read it first: its project, column, card, cleanup and brain tool rules apply to every step below.

View the current project's cards, apply the cleanup rules, and move cards between columns.

## Step 1 — Determine the project

Get the project tag (see Project in [[kanban/kanban|Kanban]]).

## Step 2 — List the cards

List each column folder under \`kanban/<project>/\`: \`backlog/\`, \`todo/\`, \`in-progress/\`, \`in-review/\`, \`done/\`. For each card, read its frontmatter (\`priority\`, \`type\`, \`project\`, \`updated\`) and its \`# <Title>\` line.

## Step 3 — Check the cleanup rules

Check every card against the Cleanup Rules in [[kanban/kanban|Kanban]]: long titles, stale In Review cards, Done overflow, and wrong or missing \`project\` fields. Collect what you find; change nothing yet.

## Step 4 — Present cards and findings

Show the user the project's open cards in a compact format, then the cleanup findings:

\`\`\`
Backlog
  fix-login-bug — p1 bug: Fix login bug on mobile
  add-email-validation — p2: Add email validation

Todo
  redesign-header — p2: Redesign the header

In Progress
  update-api — p1: Update the API endpoints

In Review
  update-docs — p3: Update the docs (in review 21 days)

Done: 63 cards

Cleanup
  update-docs has been in In Review for 21 days — complete it to Done?
  Done holds 63 cards — archive the 13 oldest?
\`\`\`

If the project has no cards, tell the user and stop.

Then ask: "Which cards do you want to move, and which cleanup items should I apply?"

Accept natural answers such as:

- "move fix-login-bug to Todo"
- "move update-docs to Done"
- "archive the old Done cards"

Valid column names: \`Backlog\`, \`Todo\`, \`In Progress\`, \`In Review\`, \`Done\`.

## Step 5 — Apply what the user approved

For each approved change:

- **Move:** move the file to \`kanban/<project>/<target column folder>/<slug>.md\` and update its \`updated\` field.
- **Archive:** move the file from \`done/\` to \`archive/\` and update its \`updated\` field.
- **Shorten a title:** rewrite the \`# <Title>\` line and add the removed detail to the top of the description; update \`updated\`.
- **Fix a project field:** set \`project\` to the folder's project, or move the card to the project folder its field names, as the user chose; update \`updated\`.

Never change \`created\`.

## Step 6 — Confirm

Tell the user what changed, one line per card. Ask whether they want to change anything else. If yes, return to Step 4. If no, stop.
`;
