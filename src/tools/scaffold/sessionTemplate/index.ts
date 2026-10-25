/**
 * The canonical empty session record that `aide_scaffold type=session` writes
 * to `.aide/session.aide`. This constant is the single source of the
 * placeholder; the fenced block under `## Placeholder` in
 * `.aide/docs/session-aide.md` is a copy, held byte-identical by the drift
 * guard in `index.test.ts`, not the other way round.
 */
const sessionTemplate = `---
intent: >
  Nothing recorded yet.
---

# AIDE SESSION

Cold-start protocol for agents reorienting on this project. This is a
snapshot of the current architectural intent and the anti-regression
invariants every build phase must hold. It is NOT historical commentary —
superseded design decisions are cut, not annotated.

## State summary

## Kanban

## The architectural intent (what the specs say after the rewrite)

## Anti-regression invariants future build phases must hold

## Where this cycle stopped (CRITICAL READING)

### What the next agent must do

### What's already done and validated

### What's left after the current cycle

## Process discipline (permanent)

## Open questions
`;

export default sessionTemplate;
