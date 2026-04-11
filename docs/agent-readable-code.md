# Agent-Readable Code

The outcome of [progressive disclosure](./progressive-disclosure.md). Progressive disclosure is the *contract* — what the writer does (folder-named-after-export, JSDoc on every function, inline narration on orchestrators). Agent-readable code is the *experience* an agent has when that contract is honored: the codebase answers questions at the shallowest tier possible, and agents spend their context window on the task, not on re-learning the repo.

A codebase can follow the tiers mechanically and still be unreadable if the names lie, the files sprawl, or the operational surface is a pile of loose scripts. This note covers the complementary rules that make the contract actually pay off.

## Naming for Agents

Agents read English. Names that are clear to you are clear to the agent — but abbreviations, acronyms, and clever names are not.

```typescript
// ❌ Agent reads 4 files to figure out what these do
processData()
handleStuff()
doWork()
utils.ts

// ✅ Agent knows immediately
validateOrderPayload()
persistAuditLog()
formatReceiptEmail()
createOrder/checkInventory/index.ts
```

**The folder name is the function name.** `createOrder/checkInventory/index.ts` exports `checkInventory`. No mental mapping required — Tier 1 of progressive disclosure only works if this rule is absolute.

## Eliminate Context Burn

Context burn is any token the agent spends that doesn't help it complete the task. Common sources:

**God files** — A 400-line file with mixed concerns forces the agent to read everything to find the 20 lines it needs. Split by responsibility.

**Dead code** — Commented-out functions, unused imports, deprecated helpers. Delete them. They cost tokens and confuse the agent about what's current.

**Magic strings** — `if (status === "QWFA")` requires the agent to search for what QWFA means. Use enums or named constants.

**Scattered scripts** — 30 scripts in a flat folder with no entry point. The agent can't remember which one solved the same problem yesterday. Consolidate into a CLI.

**Monolith handlers** — A single worker file handling 8 queue types. Split into per-queue subfolders with typed handlers.

## The Test: Would a New Hire Understand?

If a competent developer who has never seen your codebase could navigate to the right file, read the orchestrator, and understand the data flow in under 2 minutes — your code is agent-readable.

If they'd need to grep across 5 files, decode abbreviations, and mentally reconstruct the call chain — your agent will too, except it'll do it every session.
