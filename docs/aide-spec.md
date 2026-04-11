# AIDE Spec

**Autonomous Intent-Driven Engineering (AIDE)** is a methodology where intent — not code, not tests, not prompts — is the primary driver of every implementation decision. An intent doc lives next to the code it governs; when the intent changes, the code changes; when the code drifts from the intent, the code is wrong. The intent doc is the contract every downstream agent (builder, auditor, fixer) works from.

The name is a double entendre. AIDE is also an **AI Domain Expert** — a research agent that lifts the domain-expertise burden off an engineering team. Building a legal processing app traditionally requires hiring a legal expert to shape requirements, catch edge cases, and translate statute into rules an engineer can implement. Building a medical triage tool traditionally requires a clinician. Building a tax system traditionally requires an accountant. AIDE collapses that role into the agent loop: the research agent reads the sources, synthesizes the strategy, and produces a `.aide` file that captures the expertise in a form the rest of the pipeline can act on. The engineer does not need to become a legal expert. The team does not need to hire one. The `.aide` file *is* the expertise.

The research layer is optional upstream. If a human domain expert writes the intent doc directly, the pipeline works the same way. The AI domain expert is how you arrive at intent when you would otherwise need to hire someone; once the intent doc exists, the rest of the methodology treats it as authoritative regardless of who authored it.

AIDE is a three-layer model:

- **The domain expert holds the research.** Whether that expert is a human, an AI research agent, or an existing knowledge base, the raw sources live outside the project — a vault, an MCP memory store, a team wiki. The intent doc is the distillation the rest of the pipeline consumes; the raw research is loaded only when it needs to be re-cited or extended.
- **The `.aide` file holds the intent.** A short, structured brief living next to the orchestrator it governs. Strategy, outcomes, anti-patterns, domain examples. No code. This is the contract.
- **The code holds itself.** The implementation is ephemeral — if the intent changes, the code changes. The spec persists; the code is its current expression.

## File Types

| File            | Purpose                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.aide`         | The intent spec. Default and sufficient for most modules.                                                                                                                                                                                                               |
| `intent.aide`   | Same as `.aide`, renamed for disambiguation when a `research.aide` exists in the same folder.                                                                                                                                                                           |
| `research.aide` | Optional. Co-located research. Prefer external memory (brain, MCP) over this — every file in the repo fills context whether the agent reads it or not, and agents don't always honor "skip this" instructions. Only use when the research is inseparable from the code. |
| `todo.aide`     | QA work queue. Produced by the audit agent next to the intent spec during the verification loop. One discrete issue per checkbox. Consumed by fix agents. See [Automated QA](./automated-qa.md).                                                                        |

**Default to `.aide` alone.** Push research out to the brain or an MCP memory store. Only split into `research.aide` + `intent.aide` when the research genuinely can't live elsewhere. Never have both `.aide` and `intent.aide` in the same folder.

## Where `.aide` Files Live

`.aide` files live next to orchestrator `index.ts` files — **never next to helpers**. An orchestrator coordinates a pipeline; its spec provides the domain context for that pipeline. Helpers are small, focused functions — their folder name and code are self-explanatory.

**Placement rule:** if a folder contains an orchestrator that coordinates helpers, it can have a `.aide`. If it contains a single-purpose helper, it doesn't.

### Inheritance

`.aide` files at deeper levels inherit the context of their parent. A deeply nested spec doesn't re-explain the parent's strategy — that's in the parent spec. It only describes what makes *this* submodule succeed or fail. Each nested spec stays lean because the parent already carries the shared intent context.

A submodule is any meaningful subdivision of the parent module — a pipeline stage, a strategy variant, a resource type, a rendering target, a channel, a subdomain of the problem. The tree reflects the composition of the module.

### Example: nested module tree

```
src/service/<feature>/
├── .aide                              ← root strategy
├── index.ts
├── <submodule-a>/
│   ├── .aide                          ← submodule-a strategy (inherits root)
│   ├── index.ts
│   ├── <submodule-a1>/
│   │   ├── .aide                      ← submodule-a1 intent (inherits submodule-a)
│   │   ├── index.ts
│   │   └── <helper>/
│   │       └── index.ts               ← helper (no .aide)
│   ├── <submodule-a2>/
│   │   ├── .aide
│   │   └── index.ts
│   └── <submodule-a3>/
│       ├── .aide
│       └── index.ts
└── shared/
    └── <helper>/
        └── index.ts                   ← helper (no .aide)
```

Orchestrators have specs. Helpers don't. Deeper specs inherit from shallower ones. The shape of the tree matches the shape of the module — whatever best expresses its composition.

## Code Alongside the Spec

A `.aide` spec is one layer of context. The code sitting next to it is another. The spec carries the *intent and strategy*; the code carries the *shape and flow*, self-documented through progressively deeper tiers so an agent can stop at the shallowest one that answers its question.

See [Progressive Disclosure](./progressive-disclosure.md) for the full pattern: folder structure at Tier 1, JSDoc on every function at Tier 2, inline step-by-step comments on orchestrators at Tier 3. Together, the spec and the progressively-disclosed code give an agent everything it needs without reading helper bodies.

## Spec Structure

Every `.aide` file follows the same structure. **Frontmatter is required, and the four body sections below are required.** Without structure, agents generate freeform specs that don't scale — repeatability comes from the template.

The canonical template lives at [AIDE Template](./aide-template.md). Agents should read the template before writing a new spec.

### Frontmatter (required)

| Field | Purpose |
|-------|---------|
| `scope` | The module path this spec governs. One spec, one scope. |
| `intent` | One paragraph, plain language: what this module is *for*. The north star every other field serves. Written so a human reading it cold understands the purpose in ten seconds. Everything in `outcomes` must be traceable back to this sentence. |
| `outcomes.desired` | The success criteria. One or more statements describing what the module should produce. The audit agent measures actual output against this list. Keep it short — every extra entry dilutes the intent. |
| `outcomes.undesired` | The failure modes. Outputs that look correct but violate intent — the green-tests-bad-output failures. The audit agent checks these explicitly even when tests pass. |

**Scope, intent, outcomes. That's the whole contract.** Lifecycle fields like `status` or `revision` are deliberately omitted — they encode state that v1 has no orchestrator to consume, and every unused field is a token tax on every agent that reads the spec. Git history tracks change; the rule "if the intent changes, it's a new spec" is the forcing function. Lifecycle fields come back in a later revision alongside tooling that actually reads them.

`intent` states the purpose; `outcomes` is the intent-engineering contract that operationalizes it — desired is the target, undesired is the tripwire. Both outcome lists are two sides of the same declaration, and both must serve the intent above them.

### Cascading intent

`intent` inherits down the tree just like the rest of the spec. A nested `.aide` doesn't restate the parent's purpose — it narrows it to the slice of the problem *this* module owns. The agent reads the parent spec first, then the child, and the child's intent is understood as a specialization of the parent.

A child spec should:

- **Narrow the purpose** to the specific submodule it owns, not restate the parent-level mission.
- **Add outcomes** that only make sense at this level (submodule-specific formats, thresholds, shapes).
- **Add tripwires** tied to the unique failure modes of this submodule — not duplicate parent-level tripwires that apply to the whole tree.

A child spec should **not**:

- Restate the parent's purpose, invariants, or universally-applicable tripwires.
- Re-cite research that supports parent-level decisions.
- Describe behavior that any sibling submodule shares.

**Rule of thumb:** if a child `.aide` could be copy-pasted into a sibling folder and still make sense, it's too generic — push that content up to the parent. A child spec should only contain what's *specific to this submodule*.

**Outcomes cascade strictly.** A child's outcomes don't replace the parent's — they narrow them. Every ancestor's `outcomes.desired` and `outcomes.undesired` still apply to the child's output. A submodule whose local output satisfies its own outcomes but violates a parent's intent is wrong in the context of the whole application. Agents must walk the full `.aide` chain from root to leaf (via `aide_discover`) before judging whether a module's output is valid — local validity is necessary but not sufficient.

### Body sections (required)

Every spec has the same four body sections. See [AIDE Template](./aide-template.md) for the full template with inline guidance.

- **`## Context`** — Why this module exists and the domain-level background an agent needs to make good decisions. No code.
- **`## Strategy`** — The synthesized approach. How this module honors its `intent` and achieves its `outcomes.desired`. Research pulled from the brain gets distilled here into decisions — specific tactics, thresholds, structural choices, and the reasoning behind each one. Write in decision form ("do X because Y"), not description form. Cite data inline. No code.
- **`## Good examples`** — Concrete domain output that illustrates success. Real output, not code. Pattern material for QA agents verifying the system's output.
- **`## Bad examples`** — Concrete domain output that illustrates failure, especially the almost-right-but-wrong cases. Expands on `outcomes.undesired` with recognizable failure material.

Additional sections (references, constraints, state machine, etc.) are allowed when the module needs them. These four are the floor.

### Frontmatter vs Strategy — what each layer owns

- **Frontmatter (`intent` + `outcomes`)** declares *what* the module is for and *what* counts as success or failure. It is a contract — short, falsifiable, machine-readable.
- **`## Strategy` body** answers *how* — the intent combined with research from the brain, compressed into actionable decisions a builder agent can execute without re-reading the sources.

If the strategy contradicts the intent, the intent wins and the strategy is wrong. If a new research finding changes the strategy but not the intent, rewrite the strategy in place. If the intent itself changes, the scope and identity of the spec have changed — consider whether it should be a new spec entirely.

## Writing Standards

- **Specs are contracts, not essays.** Every section must drive a decision. Cut anything that doesn't.
- **Include data.** "Short subject lines work better" is useless. Concrete numbers with source attribution are actionable.
- **No code.** No filenames, no type signatures, no function bodies, no worked code examples. The code documents itself when it's written. The spec describes intent; the implementer figures out the code. Including code in a spec wastes tokens documenting something ephemeral.
- **Domain examples only.** When you show an example, show what the *output* should look like in the domain (a real email, a real report section, a real API response), not what the code that produces it looks like.
- **Each spec stands alone** except for inheritance from parent `.aide` files. Don't cross-reference sibling specs.
- **Decisions, not descriptions.** Each paragraph in `## Strategy` should state a concrete choice and the reasoning that justifies it. A builder agent reading the strategy should know what to do *and* why that approach beats the alternatives.
- **Citations ride alongside decisions.** When a decision is grounded in external data or research, name the source and the finding in-line. Don't footnote; don't link out to sources the builder would have to chase.

## When to Write a `.aide`

| Scenario | `.aide` needed? |
|----------|-----------------|
| New feature with unknown domain | Yes — at the feature root, and in submodules that implement domain logic |
| New feature with clear requirements | Yes — at the feature root; submodule specs only if domain context is needed |
| Adding a submodule to an existing feature | Only if the submodule implements domain logic beyond what the code expresses |
| Simple helper or utility | No — the folder name and code are the spec |
| Bug fix or simple change | No |

The test: if the module implements domain logic that requires context beyond the code itself, it gets a `.aide`. If the folder name + code are self-explanatory, it doesn't.

## Intent Engineering

A `.aide` file captures more than what to build — it captures **intent**. Without intent, an agent runs the tests, sees green, and calls it done. But green tests don't mean the feature works. Hidden failures only surface when someone understands what the code is *supposed* to accomplish.

The `outcomes` block gives the QA agent that understanding. `desired` tells it what to aim for; `undesired` tells it what to watch for even when everything looks fine. An output that is technically valid but violates the spec's intent — that's a hidden failure. The `undesired` list catches it. Without the spec, the agent would never flag it.

## The Agent Pipeline

AIDE isn't one agent doing everything. It's a pipeline of specialized agents, each with a clear job:

1. **Research agent (the AI domain expert)** — the stand-in for the legal expert, clinician, or industry analyst the team would otherwise need to hire. Ingests sources (vault notes, web search, MCP memory), synthesizes patterns, resolves conflicts, persists the research to the brain. Then distills the research into a `.aide` intent doc: frontmatter + the four required body sections. Downstream agents treat the output as authoritative domain expertise.
2. **Builder agent** — reads the `.aide` spec, plans and implements the feature, writes tests, runs them until green.
3. **Audit agent** — reads the spec (specifically the `outcomes` block), compares actual output against `outcomes.desired` and checks for anything in `outcomes.undesired`, writes a `todo.aide` checklist of discrete issues next to the spec. Does not propose solutions — only identifies what's wrong and where.
4. **Fix agents** — one session per `todo.aide` item. Reads the spec + `todo.aide`, fixes one item, verifies no regressions, checks the box, commits. New session for the next item.

Every agent reads the same spec. No agent needs you to explain what to build or how to build it — that context is already in the files.

See [Automated QA](./automated-qa.md) for the full QA verification loop.
