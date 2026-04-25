---
name: brain
description: >
  Signpost to the brain — an external, team-shareable knowledge store that
  holds context too durable for the repo and too cross-project for any single
  codebase (domain research, coding playbook, project history, journal,
  environment, identity, references). When the current task needs knowledge
  that isn't in the working directory, or the user references shared notes /
  research / conventions, invoke the `/aide:brain` slash command and let it
  discover and navigate the brain. This skill does NOT navigate the brain
  itself. Do NOT trigger for coding conventions or patterns (use `study-playbook`
  instead) or for first-time brain wiring (that's `/aide:brain config`, which
  `/aide` routes to directly).
---

# brain — Signpost to the Brain

Pointer skill. The brain interface lives in the `/aide:brain` slash command —
this skill exists so any agent that needs brain access discovers it.

---

## What the brain is

The brain is a knowledge store that lives **external to the project** and
**outside any single codebase**. It can be a personal store for one developer
or a shared store an entire team points at — when teammates wire their agents
to the same brain, every member's agent reads and writes against the same
playbook, research, project context, and conventions. That makes it the
authoritative source for anything the team has agreed on or learned, and the
place where new findings become reusable across projects and across people.

Typical contents: domain research, the coding playbook, project history and
context, journal logs, environment config, identity, references. AIDE's research
phase writes to it; the strategist and architect phases read from it; explorer
agents draw on it for context the code doesn't carry. The brain is a logical
surface — the underlying backend is an implementation detail the `/aide:brain`
command abstracts.

## When to invoke `/aide:brain`

Trigger when the current task needs knowledge that isn't in the working
directory:

- **Unfamiliar domain.** You're about to make a decision in a domain you have no
  loaded context for (e.g. cold email tactics, local SEO scoring, a vendor API
  quirk).
- **Shared context referenced.** The user says "check my notes," "what does the
  team do for X," "we already researched this," or names a project / research
  area / convention without giving you the file.
- **Saving findings.** You produced research, a decision, or a pattern the team
  will need again — synthesis the brain should own, not the repo.

## What `/aide:brain` does

It discovers the brain's root navigation surface first — the brain owns its own
structure and navigation rules — then follows those rules to find and return
content (or write what it's been asked to save).

## When NOT to use this skill

- **Coding conventions, patterns, architecture decisions** — use `study-playbook`.
  It's scoped to the playbook subset of the brain.
- **First-time brain wiring** — that's `/aide:brain config`, and `/aide` routes
  to it directly when the brain isn't wired yet.
- **Web lookups, repo file searches, MCP memory** — the brain is the external
  knowledge store wired to this project. Use the appropriate tool for those
  other surfaces.
