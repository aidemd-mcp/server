# Progressive Disclosure

Code structured so understanding deepens on demand, not all at once. An agent (or a human) should be able to stop at the shallowest tier that answers its question and only drill deeper when the current tier isn't enough. Every tier is a deliberate layer of documentation built into the code itself — the folder tree, the function signatures, the function bodies.

Agents re-learn the codebase every session. Progressive disclosure is what keeps that re-learning cheap: the less an agent has to read to find what it needs, the more context it has left for the actual task, and the more accurate its output.

## Tier 1 — Folder structure (zero files opened)

The folder tree *is* the high-level architecture. Every service module is a folder named after its default export (`createOrder/index.ts` exports `createOrder`). Helper subfolders are named after the helpers they contain. Listing a service directory tells an agent what the module does and what helpers it uses without opening a single file.

```
src/service/orders/createOrder/
├── validatePayload/
├── checkInventory/
├── reserveStock/
├── chargePayment/
├── emitConfirmation/
└── index.ts          ← orchestrator: imports above, reads as the order flow
```

An agent navigating this tree already knows: this module handles order creation by validating the payload, checking inventory, reserving stock, charging payment, and emitting a confirmation. No files opened.

The folder shape mirrors the shape of the module — whatever best expresses its composition. It might be a pipeline, a set of strategy variants, a set of resource types, a set of rendering targets, or any other meaningful subdivision. Subfolder names always match the default export they contain.

## Tier 2 — JSDoc on every function (file opened, bodies not read)

Every function carries a JSDoc block — orchestrators *and* helpers, no exceptions. JSDoc explains *why the function exists* and what role it plays, not a restatement of the code.

When folder names aren't enough, an agent opens the orchestrator's `index.ts` and sees the import list plus the JSDoc of each imported helper. That alone is enough to understand the complete data flow without stepping into any helper body. The orchestrator's own JSDoc summarizes the full flow.

JSDoc is non-negotiable because the alternative is an agent reading a function body and *hoping* it inferred the purpose correctly. Signatures alone lie — they tell you the shape of the inputs and outputs but not the intent.

## Tier 3 — Inline step-by-step comments (orchestrators only)

Orchestrator function bodies carry inline comments that narrate the pipeline step by step, so an agent reading the orchestrator sees the sequence of decisions without chasing every helper. Each step in the orchestrator's body is introduced by a short comment describing what this step accomplishes in the larger flow.

Helpers do **not** get step-by-step comments. Their JSDoc plus their focused implementation is enough — if a helper needs narration, it's doing too much and should be split. Helpers earn inline comments only for non-obvious implementation details: a subtle workaround, a cache invalidation reason, a specific ordering constraint. Those are rare.

## Why This Matters

The same property that makes code readable to humans makes it navigable for agents. An agent exploring a codebase can:

1. Read the folder tree → understand architecture
2. Read orchestrator imports + JSDoc → understand data flow
3. Read orchestrator body's inline steps → understand sequencing
4. Drill into a specific helper body only when the task requires it

This eliminates the need for agents to "read the whole codebase" before making changes. The folder structure is the documentation, the function signatures are the documentation, the orchestrator narration is the documentation. Every tier earns its place by saving the agent from reading the tier below it.

## The Rule

Write code so an agent can stop at the shallowest tier that answers its question:

- Folder names match exports
- JSDoc on every function
- Inline narration on orchestrators
- Drill-in is a last resort, not a default

This tier model is one half of the AIDE methodology's code-side contract — the spec ([AIDE Spec](./aide-spec.md)) carries the intent and strategy, the progressively-disclosed code carries the shape and flow.
