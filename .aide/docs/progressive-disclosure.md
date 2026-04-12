# Progressive Disclosure

Code structured so understanding deepens on demand, not all at once. An agent (or a human) should be able to stop at the shallowest tier that answers its question and only drill deeper when the current tier isn't enough. Every tier is a deliberate layer of documentation built into the code itself — the folder tree, the function signatures, the function bodies.

Agents re-learn the codebase every session. Progressive disclosure is what keeps that re-learning cheap: the less an agent has to read to find what it needs, the more context it has left for the actual task, and the more accurate its output.

## Tier 1 — Folder structure (zero files opened)

The folder tree *is* the high-level architecture. This is the **orchestrator/helper pattern**: the `index.ts` at any level is the **orchestrator** — it imports helpers, coordinates the pipeline, and is the only export. Subfolders are **helpers** — focused, independently testable functions named after what they do. This pattern applies at every layer.

**Aggressive modularization.** Every helper gets its own subfolder with an `index.ts` and a default export. Files are always `index.ts` — never name a file after what it does (that's what the folder name is for). The folder structure *is* the naming system.

```
src/service/orders/createOrder/
├── validatePayload/
│   └── index.ts      ← export default function validatePayload(...)
├── checkInventory/
│   └── index.ts      ← export default function checkInventory(...)
├── reserveStock/
│   └── index.ts      ← export default function reserveStock(...)
├── chargePayment/
│   └── index.ts      ← export default function chargePayment(...)
├── emitConfirmation/
│   └── index.ts      ← export default function emitConfirmation(...)
└── index.ts           ← orchestrator: imports above, reads as the order flow
```

An agent navigating this tree already knows: this module handles order creation by validating the payload, checking inventory, reserving stock, charging payment, and emitting a confirmation. No files opened.

**Single-helper exception.** When an orchestrator has exactly one helper, it *may* stay in the same file — but this is rare and should be the exception. When it does happen, the helper must be defined **above** the default export, never below. Humans don't hoist; code reads top-down.

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

- The orchestrator/helper pattern at every layer
- Helpers in subfolders, `index.ts` always, folder name = function name
- `export default` on every module
- JSDoc on every function
- Inline narration on orchestrators
- Drill-in is a last resort, not a default

If you notice a module that would be clearer with a different folder structure — a flat folder that should cascade, a helper that grew into an orchestrator, siblings that share logic begging for a `shared/` lift — flag it. Progressive disclosure only works when the structure stays honest about the shape of the code.

This tier model is one half of the AIDE methodology's code-side contract — the spec ([AIDE Spec](./aide-spec.md)) carries the intent and strategy, the progressively-disclosed code carries the shape and flow.
