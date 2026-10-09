/**
 * Seed text for the Create guide at `kanban/guide/create.md`, carried by the
 * template's `kanban-create` contract section.
 *
 * Obsidian-specific by design: wiki links, the `Related:` line, the
 * `mcp__brain__*` tools. A card is created by writing one file into its
 * project's column folder; there is no board file to update.
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

Part of [[kanban/kanban|Kanban]]. Read it first: its project, column, card and brain tool rules apply to every step below.

Create a new card.

## Who does what

The caller talks to the user and gathers the card details (Step 1), shows the user the new card and gets a clear yes. The \`kanban-maintainer\` agent writes the card (Step 2) and reports back. The caller confirms to the user (Step 3).

## Step 1 — Gather card details

Take whatever the user already provided (title, priority, \`--backlog\` flag).

- No title provided: ask "What's the task?"
- No priority provided: ask with these options:
  - \`p0\` — critical / blocks work
  - \`p1\` — high / should do soon
  - \`p2\` — low / nice to have
  - \`p3\` — lowest / cleanup, someday
- Title longer than about 100 characters: propose a shorter title and move the rest into the description.
- Title is vague: optionally ask for a short description. Skip this if the title is self-explanatory.
- If the user's request names a kind of work (a bug, a deploy, hardening, housekeeping), take it as \`TYPE\`. Do not ask for it; without one, \`TYPE\` is none.

The target column is Backlog if \`--backlog\` was passed, Todo otherwise.

After this step you have \`TITLE\`, \`PRIORITY\`, \`TYPE\` (or none), \`DESCRIPTION\` (or none), \`TARGET_COLUMN\` and the project tag (see Project in [[kanban/kanban|Kanban]]).

## Step 2 — Write the card

- [ ] **Generate the slug** as the kanban index describes. Target folder: \`kanban/<project>/todo/\` or \`kanban/<project>/backlog/\`. If a card with that slug already exists anywhere under \`kanban/<project>/\`, append \`-2\` (or increment) until it is unique.
- [ ] **Find the project note.** List or search \`projects/\` for the note of the project this tag belongs to (for example tag \`myproject\` → \`projects/my-app\`). If exactly one note clearly matches, use it as \`<project-note>\` with its usual display name. If none or several match, omit the \`Related:\` line and report \`PROJECT_NOTE: none\`.
- [ ] **Write the card** at \`<target folder>/<slug>.md\`:

  \`\`\`markdown
  ---
  project: <project tag>
  priority: <priority>
  type: <type in lower case — omit this line if none>
  created: <YYYY-MM-DDTHH:MM:SS>
  updated: <YYYY-MM-DDTHH:MM:SS>
  ---

  # <Title>

  Related: [[projects/<project-note>|<display-name>]]

  <Description if provided. Otherwise omit this line.>
  \`\`\`

- [ ] **Report in this format:**

  \`\`\`
  CREATED:
  SLUG: <slug>
  PATH: <brain-relative path>
  PRIORITY: <priority>
  COLUMN: <target column>
  PROJECT: <project tag>
  PROJECT_NOTE: <projects/<project-note> or "none">
  \`\`\`

## Step 3 — Confirm

Tell the user: card created as \`<SLUG>\` (priority \`<PRIORITY>\`) in \`<COLUMN>\`. One line.
`;
