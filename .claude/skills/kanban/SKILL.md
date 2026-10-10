---
name: kanban
description: >
  Work the project's kanban board kept in the brain: create, work, manage,
  move, complete, stash and review tasks. Trigger when the user says
  "/kanban", "add a task", "create a task", "what should I work on",
  "move that task", "show the board", "stash context", "review the task",
  or otherwise asks to track, pick up, move or finish a piece of project work
  on the board.
---

# /kanban — Kanban Board

The tasks live in the brain, one folder per project with a subfolder per column — the folders are the board. The `kanban-maintainer` agent does every read and write of the tasks: it reads the kanban rules and the operation guides from the brain itself and reports back compactly. You talk to the user and decide; it finds and changes. If the agent isn't available, say so and stop — never edit the board another way.

Arguments name the operation and its input, e.g. `/kanban create "..."`. If no operation is given, ask the user which one.

- **Project tag.** Every request to the agent carries the project's tag. Look for it first in the project's instructions file (`CLAUDE.md`, `AGENTS.md` or your framework's equivalent), on a line reading `Kanban project tag: <tag>`. If there is no such line, ask the user which project the work is for, then add that line to the instructions file yourself and tell the user you recorded it, so no later session asks again. Never guess the tag.
- **Finding tasks.** Never list or search the project's tasks yourself. Ask the agent to LIST or FIND tasks: it reports each task's column, slug, priority, title, a short excerpt and its path. A single task is small — read it in full from that path whenever you need more than the excerpt.
- **Approve, then apply.** Before any change except a stash, show the user exactly what will change — which task moves from which column to which, or the new task's title, priority, type, description and column — and get a clear yes. Ask for anything missing first: a create needs a title and a priority (`p0` critical, `p1` high, `p2` low, `p3` lowest); a move needs a column (Backlog, Todo, In Progress, In Review, Done). Then send the agent an APPLY naming each change by slug, and tell the user what it reports.
- **create, move, complete** — approve, then APPLY. Move and complete act on the task this session is working on; name it by slug, and ask if it isn't clear. Complete goes to In Review, or to Done when the user asks.
- **manage** — have the agent LIST the open tasks and CHECK the cleanup rules, show both to the user, ask what to move and which cleanup items to apply, approve, then APPLY.
- **stash** — write the content yourself from the conversation, since only you have it: changes made, decisions and why, open questions, remaining work, gotchas. APPLY it into the session's task without asking first — a stash only appends a record of the session and moves or creates nothing. The agent formats and appends it; tell the user it was stashed.
- **work and review** — these plan, implement, test and fix, not just board work. Read the kanban index `kanban/kanban.md` from the brain, then only the guide it links for the operation, and follow it step by step. Every board or task change inside it still goes to the agent, approved as above (stashes excepted).
