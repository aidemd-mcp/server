/**
 * Seed text for the Stash guide at `kanban/guide/stash.md`, carried by the
 * template's `kanban-stash` contract section.
 *
 * Obsidian-specific by design: wiki links and the card's `## Stash` entry
 * format; the card is found in its project's column folders. The `## Stash` and
 * `### <YYYY-MM-DD HH:MM>` lines inside the entry-format fences are card
 * content, not guide headings, so they stay unpromoted.
 *
 * The text lands in the brain exactly as written here (ending in one newline);
 * the config seeding step splits the frontmatter from the body when writing.
 */
export default `---
tags:
  - tasks
  - workflow
---
# Stash

Part of [[kanban/kanban|Kanban]]. Read it first: its project, column, card and brain tool rules apply to every step below.

A stash only appends a record of the session to the card; it moves and creates nothing, so it needs no approval from the user.

Stash session context into the current card: what changed, decisions made, open questions and remaining work. Use this at the end of a session, or at any point mid-session, to persist everything learned so a future session can pick up seamlessly.

## Step 1 — Identify the card from session context

Look back through the current conversation for the card that was worked on this session. Signals: a card picked through Work, a card moved to In Progress through Manage, or a card file read or referenced during the session.

If no card can be identified, ask the user which card to stash to and stop until they answer.

## Step 2 — Determine the project

Get the project tag (see Project in [[kanban/kanban|Kanban]]).

## Step 3 — Read the card

Find \`<slug>.md\` in the project's column folders under \`kanban/<project>/\` and read it to see which sections already exist (Investigation, Answers, Solution, Revisions, earlier Stash entries). You need to know the current state so you do not duplicate information.

## Step 4 — Gather session context

Collect information from these sources, in parallel where possible.

### 4a — Git changes (if in a git repo)

Run \`git diff --stat\` and \`git log --oneline -10\` to see which files changed and which commits were made during this session. If there are uncommitted changes, record them.

### 4b — Conversation review

Review the conversation for:

- **What was done:** concrete changes made (files modified, new behavior added, bugs fixed, refactors performed). Be specific: name files, functions and what changed.
- **Key decisions:** choices made and why. Include the alternatives that were considered and rejected, and the reasoning. This is the most valuable part: a future session needs to know not just what was chosen but why the alternatives lost.
- **Open questions:** anything unresolved, unclear or deferred. Things that need more investigation or user input, or that depend on external factors.
- **Remaining work:** what is left to do to complete the card. Be concrete: name specific files, functions or steps. If there is a rough order, give it.
- **Gotchas and surprises:** anything unexpected discovered during the session that future sessions should know about (weird behavior, undocumented constraints, things that look like bugs but are not).

## Step 5 — Compose and append the stash entry

Append a \`## Stash\` section to the card. If a \`## Stash\` section already exists (from a prior session), append a new dated subsection under it — do NOT overwrite prior stash entries.

Format:

\`\`\`markdown
## Stash

### <YYYY-MM-DD HH:MM>

**Changes made:**
- <file or area>: <what changed and why>

**Decisions:**
- <decision>: <reasoning, alternatives considered>

**Open questions:**
- <question or uncertainty>

**Remaining work:**
- [ ] <concrete next step>

**Gotchas:**
- <anything surprising or non-obvious>
\`\`\`

Omit any section that has no content (for example, if there are no gotchas, skip that heading). Do not pad with filler: every line should carry information.

If a \`## Stash\` section already exists, append the new entry as a new \`###\` dated subsection at the bottom of the existing Stash section:

\`\`\`markdown
### <YYYY-MM-DD HH:MM>

**Changes made:**
...
\`\`\`

## Step 6 — Update frontmatter

Update the card's \`updated\` field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).

## Step 7 — Confirm

Tell the user the stash was saved. Show a brief summary of what was recorded (one line per section that was included). If there are open questions or remaining work items, highlight them so the user is aware of loose ends.
`;
