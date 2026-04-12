---
name: study-playbook
description: >
  Load relevant coding-playbook sections from the Obsidian vault for the current task.
  Navigates the playbook hub top-down: reads the index, identifies which sections apply,
  drills into section hubs, then reads the specific child notes needed. Use this skill
  whenever you need to look up coding conventions, patterns, or architecture decisions
  before writing or reviewing code. Do NOT trigger for non-coding vault work.
---

# /study-playbook — Load Coding Playbook Context

Navigate the coding playbook hub and load only the sections relevant to the current task.

---

## Step 1: Read the Playbook Hub

Read `coding-playbook/coding-playbook.md` via `mcp__obsidian__read_note`.

This hub has sections, each with a one-line "Read when..." description. Do NOT read
all sections — match the task's domain against the descriptions to identify which 1-3
sections apply.

Common mappings:

| Task domain | Section |
|-------------|---------|
| Naming anything (functions, files, variables) | Foundations |
| Code style, formatting, philosophy | Foundations |
| Function ordering, default export placement | Foundations |
| Comments, JSDoc, documenting orchestrator files | Foundations |
| What to avoid (anti-patterns) | Foundations |
| New project, tsconfig, tooling setup | Setup |
| Where does this file go? File/folder structure | Architecture |
| Function signatures, data flow conventions | Architecture |
| Database, models, schema design | Data |
| Business logic, service layer | Services |
| Error handling, error propagation | Services |
| API routes, request/response types | API |
| Validation, auth middleware | API |
| UI components, pages, client-side fetch | Client |
| Feature build order, shipping checklist | Workflow |
| Testing, mocking, test factories | Workflow |
| Type definitions, derived types | Workflow |
| LLM integration, RAG, chatbots | AI |

---

## Step 2: Read the Relevant Section Hubs

For each matching section, read its hub note (e.g. `coding-playbook/services/services.md`).

Section hubs list their child notes with keywords. Scan the list and identify which
specific child notes overlap with the task. Do NOT read every child — only the ones
whose keywords match the work.

---

## Step 3: Read the Specific Child Notes

Read the child notes identified in Step 2 (e.g. `coding-playbook/services/error-handling.md`).
These contain the concrete patterns and code examples to follow.

---

## Navigation Rules

- **Use the hub's link structure, not search.** Do NOT use `mcp__obsidian__search_notes`
  to find playbook content. Searching produces fragments without context; the hub
  structure gives you the full picture.
- **Read top-down.** Hub -> section hub -> child note. Never skip levels.
- **Follow wikilinks 1-2 levels deep from content notes.** Hub notes (tagged `hub` or
  acting as section indexes) are navigation — they don't count as depth. Depth starts
  at the first content note you land on.
- **Never re-read notes.** Before reading any note, check whether it already appears
  in your conversation context from a prior tool call. Skip any link whose target you
  have already read in this session.
- **Invoke incrementally, not all at once.** Multi-step work crosses multiple domains.
  Load what you need for the current step. When you move to the next step and realize
  you need a new domain, invoke this skill again. The "never re-read" rule keeps
  repeated invocations cheap.
- **Stop when you have enough.** If the step only touches one domain, you only need
  that one section's notes plus whatever they link to.
