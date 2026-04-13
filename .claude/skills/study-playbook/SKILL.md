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

The hub lists sections with descriptions. Match your current task domain against
those descriptions to identify which sections apply. Do NOT read all sections —
only the ones whose descriptions overlap with the work at hand.

---

## Step 2: Read the Relevant Section Hubs

For each matching section, read its hub note (e.g. `<section>/<section>.md`).

Section hubs list their child notes with keywords. Scan the list and identify which
specific child notes overlap with the task. Do NOT read every child — only the ones
whose keywords match the work.

---

## Step 3: Read the Specific Child Notes

Read the child notes identified in Step 2 (e.g. `<section>/<child-note>.md`).
These contain the concrete patterns and code examples to follow.

---

## Navigation Rules

- **Use the hub's link structure, not search.** Do NOT use `mcp__obsidian__search_notes`
  to find playbook content. Searching produces fragments without context; the hub
  structure gives you the full picture.
- **Read top-down.** Hub → section hub → child note. Never skip levels.
- **Follow wikilinks 1–2 levels deep from content notes.** Hub notes (tagged `hub` or
  acting as section indexes) are navigation — they don't count as depth. Depth starts
  at the first content note you land on. Example:
  - `coding-playbook.md` (root hub) → depth 0 (navigation)
  - `foundations/foundations.md` (section hub) → depth 0 (navigation)
  - `foundations/conventions.md` (content note) → depth 0 (first real content)
  - wikilink from `conventions.md` → depth 1
  - wikilink from *that* note → depth 2

  When reading any content note, look for `[[wikilinks]]`. If a linked note looks
  relevant to the task, read it — then check *that* note's links too. Go at least
  1–2 levels deep from the first content note in any direction where the information
  could apply. Playbook notes cross-reference each other (e.g. a services note may
  link to error-handling patterns, which links to API response conventions). Following
  these links is how you build the full picture, not just a fragment.
- **Never re-read notes.** Before reading any note, check whether it already appears
  in your conversation context from a prior tool call. This skill may be invoked
  multiple times in a single workflow — do NOT re-read the playbook hub, section hubs,
  or child notes you have already loaded. The same applies when following wikilinks:
  skip any link whose target you have already read in this session.
- **Invoke incrementally, not all at once.** Multi-step work (e.g. planning an
  end-to-end feature) crosses multiple domains — types, then services, then API, then
  client. Do NOT try to load every section upfront. Load what you need for the current
  step. When you move to the next step and realize you're in a new domain without the
  relevant playbook context, invoke this skill again. The "never re-read" rule keeps
  repeated invocations cheap — you'll skip the hub and any notes already loaded, and
  only read the new sections you actually need.
- **Stop when you have enough.** Within a single invocation, if the step only touches
  one domain (e.g. just API routes), you only need that one section's notes plus
  whatever they link to. Don't load unrelated sections "just in case."
