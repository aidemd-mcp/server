# /aide:handoff — Session Handoff

> **Agent:** This command is executed by the `aide-spec-writer` agent in `session.aide` mode (CREATE or UPDATE). The orchestrator gathers the pipeline-state content from conversation context and supplies it in the delegation prompt; the spec-writer transcribes it into the canonical `session.aide` format. The orchestrator NEVER writes the file itself.

Record current pipeline state to `.aide/session.aide` — the project-wide pipeline-position log. Use this at meaningful pipeline-state transitions when the next session (yours or another agent's) needs to resume from a known point. **CREATE** on first invocation per feature; **UPDATE** on every subsequent transition. The maintainer agent (not this command) handles deletion at feature close. See [session.aide spec](../../.aide/docs/session-aide.md) for the file format.

## When to invoke

- A multi-cycle feature is mid-pipeline and the conversation will resume in a future session
- A pipeline stage just completed (Plan approved, Build done, QA passed) and downstream agents need the resume context
- An architectural decision was settled that downstream agents must not re-debate
- An anti-regression invariant was added that every future build phase must check
- The user paused for review and the next agent needs to know exactly where to pick up

Single-cycle builds and trivial fixes do NOT need a handoff. The orchestrator can carry their context in conversation alone. Reserve `session.aide` for work that actually spans cycles.

## Checklist

- [ ] **Detect operation mode.** Check whether `.aide/session.aide` exists:
  - File missing → **CREATE** mode (this is the first handoff for the in-flight feature)
  - File exists → **UPDATE** mode (apply a surgical diff to the existing log)
- [ ] **Orchestrator: gather content from conversation.** Before delegating, name the pieces the spec-writer needs. Never delegate with "figure out what should be in there" — the orchestrator owns the conversation context; the spec-writer cannot read it.
  - **For CREATE:** feature intent (one line for the frontmatter `intent:` field); state summary (current stage + what was just done + what's blocked); `## Where this cycle stopped` content (the next agent's instructions); architectural decisions settled (numbered list, if any); anti-regression invariants (bullet list, if any); process discipline notes (optional); open questions (optional)
  - **For UPDATE:** change description (what transition occurred); section-targeted edits (e.g. "append decision #4: ...", "rewrite `## Where this cycle stopped` to: ..."); numbered references the orchestrator wants preserved (decision #N, etc.)
- [ ] **Orchestrator: delegate to `aide-spec-writer`** with the operation type named explicitly (`session.aide CREATE` or `session.aide UPDATE`) and all supplied content quoted verbatim in the prompt. The spec-writer's default operation is `.aide` frontmatter — naming the operation type is mandatory for correct dispatch.
- [ ] **Spec-writer: read `.aide/docs/session-aide.md`** to confirm the canonical format before writing.
- [ ] **Spec-writer: enforce preconditions.**
  - CREATE REFUSES if `.aide/session.aide` already exists (orchestrator should have called UPDATE)
  - UPDATE REFUSES if `.aide/session.aide` is missing (orchestrator should have called CREATE)
  - Either REFUSES on ambiguous prompts or missing load-bearing content (feature intent, `## Where this cycle stopped`)
- [ ] **Spec-writer: write the file.** Use `Write` for CREATE, `Edit` for UPDATE. Preserve stable decision numbers across edits — when a decision is retired, leave the gap; never renumber. Cut superseded prose; do not annotate with "previously: ...". Update the `(set <date>, <phase>)` parenthetical in `## State summary` whenever the section is touched.
- [ ] **Spec-writer: return verdict** — CREATED, UPDATED, or REFUSED with the precondition that failed. On REFUSED, the orchestrator fixes the prompt (right operation type, supplied content) and re-delegates — it never writes the file itself.

## What this command does NOT do

- It does not delete `.aide/session.aide`. That belongs to the `aide-maintainer` agent and runs at feature close, not on transitions
- It does not interview the user. The orchestrator owns the user conversation; the spec-writer only formats orchestrator-supplied content
- It does not invent content. Every substantive line in `session.aide` traces back to the orchestrator's delegation prompt. If the orchestrator's prompt doesn't supply a section's content, the spec-writer omits the section or writes a one-line placeholder — it never fabricates state
- It does not apply the Brevity Contract. `session.aide` is operational state, not durable intent — no caps on description, no word counts, no forbidden-content rules from the `.aide` body. The Brevity Contract is `.aide`-only
