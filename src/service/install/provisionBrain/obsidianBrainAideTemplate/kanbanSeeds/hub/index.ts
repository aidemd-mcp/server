/**
 * Seed text for the kanban index at `kanban/kanban.md`, carried by the
 * template's `kanban-index` contract section.
 *
 * Obsidian-specific by design: it reproduces the user's working kanban
 * conventions (wiki-link card slugs, `P# TYPE:` prefixes, the `Related:` line,
 * the `%% kanban:settings` preservation rule, the `mcp__brain__*` tool table).
 * It holds only the rules shared by every operation (Board and Columns, Cards,
 * Project Tag, Reaching the Board) plus an Operations list linking the seven
 * per-operation guides under `kanban/guide/`.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
  - hub
---
# Kanban

How to work the project's kanban board: create, work, manage, move, complete, stash and review cards. Read this page first: Board and Columns, Cards, Project Tag and Reaching the Board apply to every operation. Then read only the guide for the operation the user asked for, listed under Operations, and follow it step by step without skipping a gate.

Operations take their inputs from the user's request (a title, a priority, a card slug, a column, or a flag such as \`--backlog\` or \`--done\`). A flag may also be stated in words.

## Operations

- [[kanban/guide/create|Create]] — create a new card on the board.
- [[kanban/guide/work|Work]] — pick the next card, plan it, implement it, test it and review it, behind approval gates.
- [[kanban/guide/manage|Manage]] — view the project's cards and move them between columns.
- [[kanban/guide/move|Move]] — move the current session's card to a named column.
- [[kanban/guide/complete|Complete]] — move the current session's card to In Review, or to Done with \`--done\`.
- [[kanban/guide/stash|Stash]] — save the session's context into the current card.
- [[kanban/guide/review|Review]] — review the current card's changes and, when asked, run the fix cycle.

## Board and Columns

- The board lives at \`kanban/board.md\`.
- There are five columns, in this order: Backlog, Todo, In Progress, In Review, Done.
- Each column has a folder that holds its cards: \`kanban/backlog/\`, \`kanban/todo/\`, \`kanban/in-progress/\`, \`kanban/in-review/\`, \`kanban/done/\`.
- Each board line is \`- [ ] [[<card-slug>]] — <P#> <TYPE>: <summary> #<project-tag>\`. Cards in Done use \`- [x]\`. For example:
  \`- [ ] [[fix-login-bug]] — P1 BUG: Fix login bug on mobile #myproject #mobile\`
  - The slug is a wiki link: \`[[<card-slug>]]\`, the card's file name without \`.md\`.
  - \`<P#>\` is the priority in upper case (\`P0\`, \`P1\`, \`P2\`, \`P3\`), matching the card's priority tag.
  - \`<TYPE>\` is optional, one upper-case word for the kind of work (\`BUG\`, \`DEPLOY\`, \`HARDENING\`, \`MAINTENANCE\` and so on). Without a type the prefix is just \`<P#>:\`.
  - \`<summary>\` is the card title or a one-line summary of it.
  - The line ends with one or more \`#<project-tag>\` tags, the project tag always among them.
  - Older lines may lack the \`<P#>\` prefix. Leave them as they are; never rewrite a line's text when moving it.
- To read a board line, take the slug from inside \`[[\` \`]]\` and the priority from the \`P#\` prefix if present (the card's frontmatter is authoritative).
- A moved line goes to the bottom of its target column: just before the blank line(s) that precede the next column heading. For Done, that is just before the blank line that precedes the \`%% kanban:settings\` block at the end of the file.
- Entering Done checks the box (\`- [ ]\` becomes \`- [x]\`). Leaving Done unchecks it (\`- [x]\` becomes \`- [ ]\`). Every other move leaves the box unchanged.
- When editing the board, rewrite the whole file and preserve everything above the first column heading (the frontmatter) and the trailing \`%% kanban:settings\` block exactly as they are.
- A card's folder must match the column its board line sits in. Moving a card means doing both: update the board, then move the file.

## Cards

- Each card is one markdown file at \`kanban/<column-folder>/<slug>.md\`.
- Frontmatter:
  - \`tags\`: the project tag(s) and a priority tag (\`p0\`, \`p1\`, \`p2\` or \`p3\`), optionally followed by a lower-case type tag (\`bug\`, \`deploy\` and so on) matching the board line's \`<TYPE>\`;
  - \`created\` and \`updated\`: both \`YYYY-MM-DDTHH:MM:SS\`;
  - \`sessions\`: optional, a list of datetimes, one appended each time a work session starts on the card.
- Body: \`# <Title>\`, a blank line, then a \`Related: [[projects/<project-note>|<display-name>]]\` line linking the project's note under \`projects/\`, then the description if there is one. The \`Related:\` line may add further links to related cards, separated by \` · \` (for example \`Related: [[projects/my-app|My App]] · [[add-email-validation]]\`). The project note name is not always the project tag (tag \`myproject\` links \`[[projects/my-app|My App]]\`), so look the note up under \`projects/\` rather than deriving it from the tag.
- Later sections (Stash, Review, Revisions and so on) are appended to the card and never overwrite earlier entries.
- Priorities: \`p0\` is critical or blocking, \`p1\` is high (do soon), \`p2\` is low (nice to have), \`p3\` is lowest (cleanup, someday). A card with no priority is treated as \`p2\`. The priority is also called the severity. On the board it is written upper case (\`P0\`–\`P3\`).
- Any operation that changes a card updates its \`updated\` field to the current datetime. \`created\` is never changed.

## Project Tag

Every card and every board line carries the project's tag, and operations filter the board by it.

If the tag is not already known in this session, ask the user which project the work is for and use the answer as the tag. Never guess it. Once known, reuse it for the rest of the session and pass it explicitly to every subagent that needs it.

## Reaching the Board

Read and write the board and the cards only with the brain read and write tools available in this session. Never assume a storage backend, and never bypass those tools: no native file reads or writes, no shell listing, no direct editing of files on disk.

In this brain the tools are the \`brain\` MCP server's \`mcp__brain__*\` tools. Every operation in this guide needs only these capabilities from them:

| Capability | Brain tool | Used for |
| ---------- | ---------- | -------- |
| read a file by its brain-relative path | \`mcp__brain__read_note\` (or \`mcp__brain__read_multiple_notes\`) | the board, a card |
| write a file (overwrite) | \`mcp__brain__write_note\` (mode \`overwrite\`) | creating a card, rewriting the whole board |
| append to a file | \`mcp__brain__write_note\` (mode \`append\`) or \`mcp__brain__patch_note\` | adding a Stash, Review or Revisions entry to a card |
| move a file | \`mcp__brain__move_note\` | moving a card to another column folder |
| read and update frontmatter | \`mcp__brain__get_frontmatter\`, \`mcp__brain__update_frontmatter\` | \`updated\`, \`sessions\` |
| search | \`mcp__brain__search_notes\`, \`mcp__brain__list_directory\` | finding a card by slug or name, domain context, the project note under \`projects/\` |

\`mcp__brain__read_note\` returns the frontmatter separately from the body. The board has frontmatter (\`kanban-plugin: list\`, \`tags\`, \`updated\`) that the Obsidian Kanban plugin needs, so when rewriting the board with \`mcp__brain__write_note\`, pass the frontmatter you read back in its \`frontmatter\` argument; never drop it. The board file is large: if a read is too big to return at once, read it in parts with \`mcp__brain__read_note_lines\` rather than switching to the file system.

All paths are brain-relative. If the brain tools are not available in this session, stop and tell the user. Do not improvise with another route to the files.
`;
