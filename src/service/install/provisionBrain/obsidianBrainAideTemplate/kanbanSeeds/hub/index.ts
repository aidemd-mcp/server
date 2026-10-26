/**
 * Seed text for the kanban index at `kanban/kanban.md`, carried by the
 * template's `kanban-index` contract section.
 *
 * Obsidian-specific by design: wiki links, the `Related:` line, the
 * `mcp__brain__*` tool table. Folders are the board — one folder per project,
 * one subfolder per column — so there is no board file to read or rewrite.
 * It holds only the rules shared by every operation (Projects and Columns,
 * Tasks, Project, Cleanup Rules, Reaching the Tasks) plus an Operations list
 * linking the seven per-operation guides under `kanban/guide/`.
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

How to work the project's kanban tasks: create, work, manage, move, complete, stash and review. Read this page first: Projects and Columns, Tasks, Project, Cleanup Rules and Reaching the Tasks apply to every operation. Then read only the guide for the operation the user asked for, listed under Operations, and follow it step by step without skipping a gate.

Operations take their inputs from the user's request (a title, a priority, a task slug, a column, or a flag such as \`--backlog\` or \`--done\`). A flag may also be stated in words.

## Operations

- [[kanban/guide/create|Create]] — create a new task.
- [[kanban/guide/work|Work]] — pick the next task, plan it, implement it, test it and review it, behind approval gates.
- [[kanban/guide/manage|Manage]] — view the project's tasks, apply the cleanup rules, and move tasks between columns.
- [[kanban/guide/move|Move]] — move the current session's task to a named column.
- [[kanban/guide/complete|Complete]] — move the current session's task to In Review, or to Done with \`--done\`.
- [[kanban/guide/stash|Stash]] — save the session's context into the current task.
- [[kanban/guide/review|Review]] — review the current task's changes and, when asked, run the fix cycle.

## Projects and Columns

- Folders are the board. There is no board file.
- Each project has its own folder, \`kanban/<project>/\`, named by the project tag.
- Inside it, one folder per column, in this order: Backlog \`backlog/\`, Todo \`todo/\`, In Progress \`in-progress/\`, In Review \`in-review/\`, Done \`done/\`. A project may also have \`archive/\` for old Done tasks.
- A task's folder is its column. Moving a task means moving its file to the target column folder and updating its \`updated\` field — nothing else.
- To see a project's tasks, list its column folders and read each task's frontmatter and title.

## Tasks

- Each task is one markdown file at \`kanban/<project>/<column>/<slug>.md\`.
- The slug is the file name without \`.md\`: the title in lower case, spaces and special characters replaced with hyphens, leading and trailing hyphens stripped, at most 60 characters, unique within the project.
- **Never cut a slug off at the limit.** When the title's slug would run past 60 characters, write a shorter phrase that still says what the task is and ends on a whole word, so whoever picks the task up can read it. "Track playbook conformance per module and suggest where to check" becomes \`track-playbook-conformance-per-module\`, not \`track-playbook-conformance-per-module-and-suggest-where-to-c\`. The title keeps its full wording; only the slug is shortened.
- Frontmatter:
  - \`project\`: the project tag, matching the project folder;
  - \`priority\`: \`p0\`, \`p1\`, \`p2\` or \`p3\`;
  - \`type\`: optional, one lower-case word for the kind of work (\`bug\`, \`deploy\`, \`hardening\`, \`housekeeping\` and so on);
  - \`created\` and \`updated\`: both \`YYYY-MM-DDTHH:MM:SS\`;
  - \`sessions\`: optional, a list of datetimes, one appended each time a work session starts on the task.
- Body: \`# <Title>\`, a blank line, then a \`Related: [[projects/<project-note>|<display-name>]]\` line linking the project's note under \`projects/\`, then the description if there is one. The \`Related:\` line may add further links to related tasks, separated by \` · \` (for example \`Related: [[projects/my-app|My App]] · [[add-email-validation]]\`). The project note name is not always the project tag (tag \`myproject\` links \`[[projects/my-app|My App]]\`), so look the note up under \`projects/\` rather than deriving it from the tag.
- Titles are short: at most about 100 characters. The detail goes in the description, not the title.
- Later sections (Stash, Review, Revisions and so on) are appended to the task and never overwrite earlier entries.
- Priorities: \`p0\` is critical or blocking, \`p1\` is high (do soon), \`p2\` is low (nice to have), \`p3\` is lowest (cleanup, someday). A task with no priority is treated as \`p2\`. The priority is also called the severity.
- Any operation that changes a task updates its \`updated\` field to the current datetime. \`created\` is never changed.

## Project

Every operation works inside one project's folder.

If the project tag is not already known in this session, ask the user which project the work is for and use the answer. Never guess it. Once known, reuse it for the rest of the session and pass it explicitly to every agent that needs it.

## Cleanup Rules

Manage checks these and reports what it finds. Each one only flags or offers; nothing changes without the user's approval.

- **Long title.** A title longer than about 100 characters: offer a shorter title and move the rest into the description.
- **Stale In Review.** A task in \`in-review/\` whose \`updated\` is more than 14 days old: offer to complete it to Done.
- **Done overflow.** More than 50 tasks in a project's \`done/\`: offer to move the oldest (by \`updated\`) into \`archive/\` until 50 remain.
- **Wrong or missing project.** A task whose \`project\` field is missing or does not match the folder it sits in: offer to fix the field or move the task.

## Reaching the Tasks

Read and write tasks only with the brain read and write tools available in this session. Never assume a storage backend, and never bypass those tools: no native file reads or writes, no shell listing, no direct editing of files on disk.

In this brain the tools are the \`brain\` MCP server's \`mcp__brain__*\` tools. Every operation needs only these capabilities from them:

| Capability | Brain tool | Used for |
| ---------- | ---------- | -------- |
| list a folder | \`mcp__brain__list_directory\` | a project's column folders, the projects under \`kanban/\` |
| read a file by its brain-relative path | \`mcp__brain__read_note\` (or \`mcp__brain__read_multiple_notes\`) | a task |
| read and update frontmatter | \`mcp__brain__get_frontmatter\`, \`mcp__brain__update_frontmatter\` | a task's priority, \`updated\`, \`sessions\` |
| write a file (overwrite) | \`mcp__brain__write_note\` (mode \`overwrite\`) | creating a task |
| append to a file | \`mcp__brain__write_note\` (mode \`append\`) or \`mcp__brain__patch_note\` | adding a Stash, Review or Revisions entry to a task |
| move a file | \`mcp__brain__move_note\` | moving a task to another column folder |
| search | \`mcp__brain__search_notes\` | domain context, the project note under \`projects/\` |

All paths are brain-relative. If the brain tools are not available in this session, stop and tell the user. Do not improvise with another route to the files.
`;
