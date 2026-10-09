/**
 * Seed text for the Obsidian Kanban-plugin board at `kanban/board.md`, carried
 * by the template's `kanban-board` contract section.
 *
 * Obsidian-specific by design: the file opens with the `kanban-plugin: list`
 * frontmatter the plugin needs, holds the five empty columns in order, and ends
 * with the plugin's `%% kanban:settings` block. No prose sits above the first
 * column because the plugin owns that region, and no `updated` key is seeded
 * because a seed carries no fixed date. The user's personal `list-collapse`
 * view state is deliberately not part of the seed.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
kanban-plugin: list
tags:
  - tasks
---



## Backlog



## Todo



## In Progress



## In Review



## Done



%% kanban:settings
\`\`\`
{"kanban-plugin":"list"}
\`\`\`
%%
`;
