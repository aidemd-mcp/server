# AIDE Spec

**Autonomous Intent-Driven Engineering (AIDE)** puts intent at the center of everything. Not code, not tests, not prompts — intent. A short `.aide` doc lives next to the code it governs, and that doc is the contract. Architects plan from it. Implementors build from it. QA validates against it. When the intent changes, the code changes. When the code drifts from the intent, the code is wrong — full stop. Across a project, these docs form a **cascading intent tree**: a hierarchy of `.aide` specs rooted at the project level, each child narrowing the intent of its parent. Agents navigate the tree from root to leaf to understand the full context behind any module.

The name is a double entendre. AIDE is also an **AI Domain Expert** — the pipeline includes a domain expert agent that fills the brain with domain knowledge and a strategist agent that distills that knowledge into the spec's body sections. A human domain expert can fill the brain the same way the agent would — the strategist reads the brain regardless of who wrote to it. But domain expertise is a perk, not the point. Intent is the first-class citizen; research is just one way to inform it.

The brain can be filled by the domain expert agent, by a human domain expert, or by both. The pipeline downstream — strategist, architect, implementor, QA — treats the brain's content as authoritative regardless of the source. The developer decides what source is appropriate for the domain. The methodology applies to any domain; only the source of the brain's knowledge changes.

The research layer is optional. It runs only when the module needs domain knowledge that isn't already available — either from the user's interview context or from a prior session that already filled the brain. If the brain already has coverage, or the user holds the knowledge directly, the research phase is skipped and the strategist fills the body sections from what's available. Once the intent doc exists, the rest of the methodology treats it as authoritative regardless of how it got there.

AIDE is a three-layer model:

- **The brain holds durable knowledge.** External to the project — a personal knowledge base, an MCP memory server, a team wiki. Two kinds of content live here: domain research (what the module is supposed to do in the real world) and engineering conventions (how this team writes code — the coding playbook). Different agents pull different slices: the strategist draws on domain research when filling the spec body; the architect draws on the coding playbook when translating intent into a plan. Neither bloats the repo with reference material every session has to re-read.
- **The `.aide` file holds the intent.** A short, structured brief living next to the orchestrator it governs. Strategy, outcomes, anti-patterns, domain examples. No code. This is the contract.
- **The code holds itself.** The implementation is ephemeral — if the intent changes, the code changes. The spec persists; the code is its current expression.

## File Types

| File            | Purpose                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.aide`         | The intent spec. Default and sufficient for most modules.                                                                                                                                                                                                               |
| `intent.aide`   | Same as `.aide`, renamed for disambiguation when a `research.aide` exists in the same folder.                                                                                                                                                                           |
| `research.aide` | Optional. Co-located research fallback when no external brain is available. Prefer external memory (brain, MCP) over this — every file in the repo fills context whether the agent reads it or not, and agents don't always honor "skip this" instructions.              |
| `brief.aide`    | Per-module ephemeral pre-read for the architect. Carries the architectural commitments, type-level contracts, exact strings, schema details, cross-module contracts, open questions, and any mid-flight rework state the architect, implementor, and QA need but that are NOT durable intent. Created by the strategist during synthesize, lives through plan/build/QA/fix, deleted by the maintainer agent after QA passes. Not bound by the Brevity Contract. See [brief.aide spec](./brief-aide.md). |
| `plan.aide`     | The architect's implementation plan. Checkboxed steps the implementor executes top-to-bottom. Lives next to the `.aide` it implements. Ephemeral — deleted by the maintainer agent after QA passes. See [plan.aide spec](./plan-aide.md).                              |
| `todo.aide`     | QA re-alignment document. Captures where implementation drifted from intent, with per-issue misalignment tags and a retro section. One `todo.aide` per QA loop. Ephemeral — deleted by the maintainer agent after QA passes; the retro is promoted to brain at `process/retro/` before deletion. See [todo.aide spec](./todo-aide.md). |
| `session.aide`  | Project-root pipeline-position log. One file at `.aide/session.aide`, replaces the legacy `handoff.aide` pattern. Tracks the in-flight feature's current pipeline state, settled architectural decisions, anti-regression invariants, where the cycle paused. Long-lived and never deleted — rewritten for the next task when a feature closes. See [session.aide spec](./session-aide.md). |

**Default to `.aide` alone.** Push research out to the brain or an MCP memory store. Only split into `research.aide` + `intent.aide` when the research genuinely can't live elsewhere. Never have both `.aide` and `intent.aide` in the same folder.

## Where `.aide` Files Live

`.aide` files live next to orchestrator `index.ts` files — **never next to helpers**. An orchestrator coordinates a pipeline; its spec provides the domain context for that pipeline. Helpers are small, focused functions — their folder name and code are self-explanatory.

**Placement rule:** if a folder contains an orchestrator that coordinates helpers, it can have a `.aide`. If it contains a single-purpose helper, it doesn't. The one exception is the project root intent spec at `.aide/intent.aide` — the top of the cascading intent tree. It lives inside the `.aide/` folder because the project root has no orchestrator, and naming it `intent.aide` avoids ambiguity with the `.aide/` directory itself. All other specs inherit from it, directly or transitively.

### Inheritance

`.aide` files at deeper levels inherit the context of their parent. A deeply nested spec doesn't re-explain the parent's strategy — that's in the parent spec. It only describes what makes *this* submodule succeed or fail. Each nested spec stays lean because the parent already carries the shared intent context.

A submodule is any meaningful subdivision of the parent module — a pipeline stage, a strategy variant, a resource type, a rendering target, a channel, a subdomain of the problem. The tree reflects the composition of the module.

### Bootstrapping a project

Every intent tree needs a root. The project root intent spec lives at `.aide/intent.aide` — inside the `.aide/` folder alongside the methodology docs, not as a bare file at the repo root. Its `scope` is `.` (the project root) or the project name. Its `intent` describes the project's purpose at the highest level. Its `outcomes` define the project-wide success criteria and failure modes that every deeper spec inherits.

`aide_init` creates this file during project bootstrap. On the first `/aide` run against a new project, the spec writer creates it as Stage 1 before any module-level specs exist.

Without a root intent spec, child specs have nothing to inherit from. They are forced to restate project-level context that belongs at the root — or worse, they omit it entirely, leaving gaps the architect and QA agents can't fill. The root spec establishes the project-wide contract; everything below narrows it.

### Example: full project intent tree

```
project-root/
├── .aide/
│   ├── intent.aide                    ← project root intent (top of the intent tree)
│   └── docs/                          ← methodology docs (not specs)
│       └── ...
├── src/
│   ├── .aide                          ← src-level intent (narrows project root)
│   └── service/<feature>/
│       ├── .aide                      ← feature strategy (narrows src-level)
│       ├── index.ts
│       ├── <submodule-a>/
│       │   ├── .aide                  ← submodule-a strategy (inherits feature)
│       │   ├── index.ts
│       │   ├── <submodule-a1>/
│       │   │   ├── .aide              ← submodule-a1 intent (inherits submodule-a)
│       │   │   ├── index.ts
│       │   │   └── <helper>/
│       │   │       └── index.ts       ← helper (no .aide)
│       │   ├── <submodule-a2>/
│       │   │   ├── .aide
│       │   │   └── index.ts
│       │   └── <submodule-a3>/
│       │       ├── .aide
│       │       └── index.ts
│       └── shared/
│           └── <helper>/
│               └── index.ts           ← helper (no .aide)
```

The intent tree runs from `.aide/intent.aide` at the top down to the deepest feature submodule. Orchestrators have specs. Helpers don't. Deeper specs inherit from shallower ones. The shape of the tree matches the shape of the module — whatever best expresses its composition.

## Code Alongside the Spec

A `.aide` spec is one layer of context. The code sitting next to it is another. The spec carries the *intent and strategy*; the code carries the *shape and flow*, self-documented through progressively deeper tiers so an agent can stop at the shallowest one that answers its question.

See [Progressive Disclosure](./progressive-disclosure.md) for the full pattern: folder structure at Tier 1, JSDoc on every function at Tier 2, inline step-by-step comments on orchestrators at Tier 3. Together, the spec and the progressively-disclosed code give an agent everything it needs without reading helper bodies.

## Spec Structure

Every `.aide` file follows the same structure. **Frontmatter is always required. Body sections are conditional** — they exist only when the orchestrator routes through synthesize. When body sections are present, the same five always appear together (no partial bodies). Without structure, agents generate freeform specs that don't scale — repeatability comes from the template.

The canonical template lives at [AIDE Template](./aide-template.md). Agents should read the template before writing a new spec.

### Frontmatter (required)

| Field | Required | Purpose |
|-------|----------|---------|
| `scope` | Yes | The module path this spec governs. One spec, one scope. |
| `description` | Yes | **One sentence, ≤ 200 characters.** What the module does in domain terms. Makes ancestor chains in `aide_discover` self-contained — agents reading the chain understand what each spec governs without opening it. Domain vocabulary (entity names, status enums, field names) is welcome; type signatures, file paths, and argument indexes are not — see [Brevity Contract](#brevity-contract). |
| `intent` | Yes | **One paragraph, ≤ 100 words.** Plain language: what this module is *for*. The ten-second north star every other field serves. Everything in `outcomes` must be traceable back to it. |
| `outcomes.desired` | Yes | **3-6 items, ≤ 2 sentences each.** Falsifiable domain success criteria. The QA agent measures actual output against this list. Outcomes name the *what*, not the *how* — implementation contracts belong in code, plan, or brain. |
| `outcomes.undesired` | Yes | **3-6 items, ≤ 2 sentences each.** Domain failure modes — especially the almost-right-but-wrong outputs that pass tests. The QA agent checks these explicitly even when tests pass. |
| `status` | No | Alignment state set by tooling, not by the spec writer. Omit for pending (default — no review has happened). Set to `aligned` by the aligner agent after verification; set to `misaligned` by the QA agent when drift is detected. Surfaced inline in `aide_discover` output so agents reading the ancestor chain see alignment state without opening each spec. |

**Scope, description, intent, outcomes. That's the whole contract.** `status` is the one lifecycle field that exists, added alongside the tooling that reads it — the `aide_discover` ancestor chain surfaces it inline, and `aide_validate` warns when it is absent. Its three states are implicit pending (field absent — no review has happened), `aligned` (set by the aligner agent after verification), and `misaligned` (set by the QA agent when drift is detected). The field is never set by the spec writer directly; it is a tool-verified signal. No other lifecycle fields exist — `revision` and similar state encodings are deliberately omitted. Git history tracks change; the rule "if the intent changes, it's a new spec" is the forcing function.

`intent` states the purpose; `outcomes` is the intent-engineering contract that operationalizes it — desired is the target, undesired is the tripwire. Both outcome lists are two sides of the same declaration, and both must serve the intent above them.

**YAML safety rule for outcomes:** Any `outcomes.desired` or `outcomes.undesired` list item whose text contains a colon followed by a space (`: `) must be wrapped in double quotes. YAML treats `: ` as a mapping key delimiter even inside plain scalars — backtick code spans like `` `scope: path` `` or prose like `sets status: aligned` will silently break frontmatter parsing, causing all fields to appear missing to tooling. When in doubt, quote the item.

### Brevity Contract

The caps below are hard limits. The aligner enforces them; violations land in `todo.aide` as `spec-bloat`.

| Field | Hard cap |
|---|---|
| `description` | ≤ 200 characters, single sentence |
| `intent` | ≤ 100 words, single paragraph |
| `outcomes.desired` | 3-6 items, ≤ 2 sentences per item |
| `outcomes.undesired` | 3-6 items, ≤ 2 sentences per item |
| `## Context` | ≤ ~250 words. Only domain background not inherited from the parent. |
| `## Strategy` | One paragraph per decision, ≤ ~80 words each. ~7 decisions max — beyond that, the scope is too wide; split it. |
| `## Good examples` / `## Bad examples` | 2-3 examples each, brief. Pattern material, not enumeration. |
| `## References` | One bullet per brain entry actually used: path + one-line description of what was drawn. |
| **Whole-file size** | **~150 lines is the target. ~175 lines is a refactor signal — beyond that, the scope is too wide and splitting is overdue.** Section caps catch field-level bloat; the whole-file signal catches the case where every section is technically under cap but the spec has still ballooned. |

#### Forbidden content (anywhere in the file)

These belong in code, in `plan.aide`, in `brief.aide`, or in the brain — never in `.aide`:

- **Type signatures** (e.g. `(string | null)[]`, `Record<K, V>`)
- **File paths and folder layouts**
- **Argument-index or position-based contracts** (e.g. `args[3]`, "the third element"), and **schema cardinality assertions** (e.g. "exactly six sections", "at most three fields")
- **Migration history, deprecation notes, "retired" prior designs** — git tracks change; the spec describes the current contract
- **Long justifications, asides, or commentary** annotating the contract — if a sentence exists to defend or footnote another sentence, cut both
- **Function-name enumerations standing in for outcomes** — a spec describes what the module accomplishes in the domain, not which exported symbols exist

#### Domain vocabulary IS allowed and expected

Specs are written in the language of the domain, not the codebase. The following are welcome whenever they describe the system the way a non-engineer who knows the business would describe it:

- **Entity names** (e.g. `OutreachThread`, `Sequence`, `Attempt`)
- **Status enum values** (e.g. `ACTIVE`, `COMPLETED`, `CANCELLED`, `BLACKLISTED`)
- **Field names that name a domain concept** (e.g. `generationContext`, `nextFollowUpAt`)
- **Domain enum values** (e.g. `INDEXABILITY`, `TRAFFIC`, `SECURITY`)
- **Specific numbers tied to domain decisions** (e.g. "3-email cap", "7-day interval")

**The test:** if the term would land for a non-engineer who understands the business, it's domain vocabulary and belongs. If only a developer reading the code would recognize it, it's an implementation contract — keep it out. If the implementation were rewritten from scratch in a different language and the term still made sense, the spec should survive untouched.

#### When the scope is too wide — suggest child specs

If you cannot fit the intent into a single ≤ 100-word paragraph with 3-6 outcomes per list, the scope is too wide. **Do not relax the caps. Split into child specs.** Trigger conditions:

- A single outcome covers a sub-pipeline with its own success criteria
- The Strategy has more than ~7 distinct decisions
- The Good/Bad examples cluster around two or more distinct domain concerns
- The Context paragraph keeps wanting to grow because the module has multiple sub-domains
- The whole file is creeping past ~175 lines

### Cascading intent tree

The **cascading intent tree** (or **intent tree**) is the hierarchy of `.aide` specs from `.aide/intent.aide` at the project root down to the deepest module-level spec. Intent flows downward: each child spec inherits everything above it and narrows it to the slice of the problem it owns. An agent navigating the intent tree reads from root to leaf — the full chain gives the complete context for any module.

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

**Outcomes cascade strictly.** A child's outcomes don't replace the parent's — they narrow them. Every ancestor's `outcomes.desired` and `outcomes.undesired` still apply to the child's output. A submodule whose local output satisfies its own outcomes but violates a parent's intent is wrong in the context of the whole application. Agents must walk the full intent tree from root to leaf (via `aide_discover`) before judging whether a module's output is valid — local validity is necessary but not sufficient.

### Body sections (conditional)

Body sections are **optional**. A `.aide` file with only frontmatter is a valid, complete spec — a navigation stub that names the module's intent and outcomes for the cascading tree, with no further elaboration. Most modules don't need more than that.

Body sections are filled by the strategist during synthesize when — and only when — the module needs context that isn't already obvious from intent + outcomes + parent specs. The orchestrator decides whether synthesize runs (see [orchestrator routing](../../.claude/commands/aide.md)), using the pipeline test below. If the strategist is invoked, **all five body sections must be filled** — partial bodies are not permitted. If the strategist is skipped, the body section headings should not appear in the file at all.

When present, body sections persist — they are the durable domain contract, just like frontmatter. Unlike `plan.aide` / `todo.aide` / `brief.aide` (ephemeral pipeline state), filled body sections are not deleted post-QA.

### When to fill body sections — the pipeline test

A Strategy records how the system solves a real-world problem — the order its steps happen in, what each step hands the next, and why that design solves the problem. The trigger for synthesize is one question: **does this feature have an order the names don't reveal?** Several steps that must happen in a specific order — moved along by calls, events, a clock, or state changes — where each step hands something to the next. Event-driven pipelines and timed lifecycles both qualify. This doc calls them all pipelines. Research is not the trigger — a module can need research and still be self-contained, or need none and still be a step in a pipeline.

- **Pipeline → synthesize runs.** The end-to-end strategy goes in the parent spec's body: the real-world problem the flow solves, what starts it, the order of the steps, the hand-offs between them, why each step sits where it does, and what happens when a step is late, repeated or missing. Each module's own slice of that strategy goes in that module's spec body.
- **Not a pipeline → frontmatter only.** A self-contained module that does one thing — its name says it all — has no Strategy body.

The reason is that module names and outcomes describe each step alone. Nothing in them says that storage notifies a queue, that the queue reader treats each notice only as a cue and re-checks the real files, or that a sweep settles whatever a lost notice missed. That order, and why it holds, is the design — and it lives nowhere else durable.

**Decisions parked in pipeline-state files never stand in for a Strategy body.** `brief.aide`, `plan.aide` and `todo.aide` are deleted after QA, and `session.aide` is rewritten as features close. A pipeline whose hand-offs are settled only there has no durable strategy.

**Example — needs a Strategy (an event-driven pipeline: post-upload processing).** The upload request reserves space and returns size-locked links; the agent sends the files and stops; storage announces each file to the queue; the queue reader treats each notice only as a cue, re-checks the real stored files, and once every file of that upload has arrived and passed its checks publishes in one step or refuses and frees the space; duplicate or late notices find the upload already settled; a periodic sweep settles anything a lost notice missed and discards uploads that never complete.

**Example — needs a Strategy (a timed lifecycle: a cold-outreach drip sequence).** The problem: past the third cold email, replies barely rise while complaints and sender-reputation damage do. So a sequence is capped at three emails, each a draft the user approves. The conversation thread is created before the sequence, so the inbox stays coherent even if a later step fails. Each email records which audit gap it raised, and that record is the hand-off — the next email reads it to raise a different gap without re-fetching the audit. The seven-day wait starts when an email is sent, not drafted. Two triggers own two exits: a daily sweep advances the sequence, or closes it once three emails go unanswered or a reply arrives; delivery events (bounce, complaint) are the only thing that cancels it, deleting unsent drafts. None of that order is visible in module names like follow-up, final email or reply sweep.

**Example — needs a Strategy (an event-driven pipeline: inbound reply handling).** The problem: a prospect's reply must stop the outreach and route to a person, exactly once. The mail provider's event arrives; it is matched to its conversation thread; the reply is classified as interested, not now, or unsubscribe; the sequence is closed, paused, or the contact is blocked; a task is created for follow-up. A duplicate event finds the thread already handled, and a reply that arrives before its send was recorded is held and retried rather than dropped.

**Example — skip it (an upload module).** "Uploads a file to storage under the item's folder." Anyone calls it and it uploads; nothing follows it and nothing depends on its order.

**Example — skip it, even though it is complex (a pricing calculator).** Many tiers, discounts and regional rules, but one call in and one price out — no steps, no order, no hand-offs. Its complexity belongs in outcomes, or in brain research if the rules are unknown territory; that is the Research signal, not Strategy.

The five sections, when filled:

- **`## Context`** — Why this module exists and the domain-level background an agent needs to make good decisions. No code.
- **`## Strategy`** — How the system solves the real-world problem: how the modules interact, and why. What starts the flow, who calls or notifies whom, in what order, what each hand-off carries, and what happens when one is late, repeated or missing — each decision naming the outcome it serves. Research pulled from the brain, when there is any, gets distilled here into decisions. Write in decision form ("do X because Y"), not description form. Cite data inline. No code. A Strategy never restates the intent or outcomes above it in the same file, never recounts history, and never cites `session.aide`, `brief.aide`, `plan.aide` or `todo.aide`.
  - *Bad — a table of contents:* "The request module creates the upload. The queue module reads messages. The publish module publishes." It lists what each module does, never how they interact.
  - *Bad — duplication:* a decision that restates an outcome ("go live all at once, keeping the prior version") instead of explaining the hand-off that guarantees it, or a Context that walks the pipeline and a Strategy that walks it again.
- **`## Good examples`** — Concrete domain output that illustrates success. Real output, not code. Pattern material for QA agents verifying the system's output.
- **`## Bad examples`** — Concrete domain output that illustrates failure, especially the almost-right-but-wrong cases. Expands on `outcomes.undesired` with recognizable failure material.
- **`## References`** — A flat list of brain entries the synthesis agent read during strategy writing, each as a path plus a one-line description of what was drawn from it. Its purpose is human auditability: a reviewer can trace every strategy decision back to the research that informed it without re-running the pipeline. Populated by the synthesis agent as a side effect of normal synthesis — not filled manually after the fact. Paths are not required to be valid links; the description is the fallback by design.

Additional sections (constraints, state machine, etc.) are allowed when the module needs them — but only as part of a full body, not as standalone additions to a frontmatter-only spec.

### Frontmatter vs Strategy — what each layer owns

- **Frontmatter (`intent` + `outcomes`)** declares *what* the module is for and *what* counts as success or failure. It is a contract — short, falsifiable, machine-readable. **Always present.**
- **`## Strategy` body** (when filled) answers *how* — how the modules hand off to each other, combined with any research from the brain, compressed into actionable decisions the architect can turn into a plan and the implementor can execute without re-reading the sources. **Optional — present only when the orchestrator routed through synthesize.**

If the strategy contradicts the intent, the intent wins and the strategy is wrong. If a new research finding changes the strategy but not the intent, rewrite the strategy in place. If the intent itself changes, the scope and identity of the spec have changed — consider whether it should be a new spec entirely.

**When body sections aren't filled, where does "how" live?** In the user's implementation context to the orchestrator (which the orchestrator hands directly to the architect), the brain's coding playbook (which the architect consults), and the architect's `plan.aide` itself. The body sections earn their place when the feature is a pipeline — the order and hand-offs between modules are a design no module's name or outcomes reveal (see [the pipeline test](#when-to-fill-body-sections--the-pipeline-test)).

## Writing Standards

- **Specs are contracts, not essays.** Every section must drive a decision. Cut anything that doesn't.
- **Include data.** "Short subject lines work better" is useless. Concrete numbers with source attribution are actionable.
- **No code.** No filenames, no type signatures, no function bodies, no worked code examples. The code documents itself when it's written. The spec describes intent; the implementer figures out the code. Including code in a spec wastes tokens documenting something ephemeral.
- **Domain examples only.** When you show an example, show what the *output* should look like in the domain (a real email, a real report section, a real API response), not what the code that produces it looks like.
- **Each spec stands alone** except for inheritance from parent `.aide` files. Don't cross-reference sibling specs.
- **Decisions, not descriptions.** Each paragraph in `## Strategy` should state a concrete choice and the reasoning that justifies it. An architect reading the strategy should know what to do *and* why that approach beats the alternatives, so the plan it produces can handle unanticipated edge cases without re-opening the spec.
- **Citations ride alongside decisions.** When a decision is grounded in external data or research, name the source and the finding in-line. Don't footnote; don't link out to sources a downstream agent would have to chase.

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

AIDE isn't one agent doing everything. It's a pipeline of specialized agents, each with one job and a narrow set of inputs. Every stage runs in a fresh context — no agent carries conversation from a prior stage. Handoff is via files only: `.aide`, `plan.aide`, `todo.aide`, and entries persisted to the brain. Splitting the roles is how each agent keeps its context small enough to stay accurate.

The pipeline is driven by an **orchestrator** (`/aide`) that interviews the user, detects pipeline state from existing files, and spins up each agent in sequence. The orchestrator can resume mid-pipeline — if a user starts a new session and runs `/aide`, it picks up where the last session left off by checking which files exist.

1. **Spec Writer** (`/aide:spec`). Takes the orchestrator's delegation context — gathered from its interview with the user — and distills it into `.aide` frontmatter: `scope`, `intent`, `outcomes.desired`, `outcomes.undesired`. No body sections, no research, no code. The spec writer structures intent into a falsifiable contract; the orchestrator owns the user conversation. The frontmatter is presented to the user for confirmation before proceeding.

2. **Domain Expert** (`/aide:research`). *Optional.* Fills the brain with domain knowledge — the same role a human domain expert would play, automated. Runs only when the module requires domain knowledge that isn't already available. Ingests sources (existing brain entries, web search, MCP memory), synthesizes patterns, resolves conflicts, and persists the result to the brain filed by **domain** (e.g., `research/email-marketing/`), not by project — domain knowledge is reusable. If no external brain is available, falls back to a co-located `research.aide`. The domain expert never writes `.aide` files; its sole output is reusable knowledge.

3. **Strategist** (`/aide:synthesize`). *Runs when the feature is a pipeline.* Reads the orchestrator's description of how the modules hand off, plus any domain knowledge in the brain, and distills them into the `.aide` body sections: `## Context`, `## Strategy`, `## Good examples`, `## Bad examples`, `## References`. Uses `aide_discover` to walk the intent tree. Every strategy decision must trace to an outcome; anything that doesn't serve the intent gets cut.

4. **Architect agent** (`/aide:plan`). Translates the complete `.aide` spec into a `plan.aide` — a checkboxed implementation plan the implementor executes top-to-bottom. Reads the `.aide` for what the module must produce, pulls the coding playbook from the brain for how this team writes code, and reads the current codebase for what already exists. Output: file placement, naming, sequencing, contracts, reuse decisions, test steps. No code. The plan is presented to the user for approval before build begins. See [plan.aide spec](./plan-aide.md).

5. **Implementor agent** (`/aide:build`). Executes `plan.aide`. Reads the plan and the `.aide` spec, writes the code, writes the tests, checks each plan step off as it completes, runs tests until green. The same agent type also runs the fix loop (`/aide:fix`) — one session per `todo.aide` item, clean context each time. If the plan is ambiguous, escalates back to the architect rather than inventing an answer.

6. **QA agent** (`/aide:qa`). Uses `aide_discover` to walk the full intent tree, compares actual output against `outcomes.desired`, checks for anything in `outcomes.undesired`, and writes a `todo.aide` re-alignment document next to the spec. Each issue traces to a specific outcome and is tagged with the pipeline stage where intent was lost (`misalignment`). Includes a `## Retro` section capturing what would have caught the issues earlier. Does not propose solutions. See [todo.aide spec](./todo-aide.md).

The fix loop cycles between QA and Implementor: QA produces `todo.aide`, the implementor fixes one item per session in clean context, QA re-validates. When all items are resolved, the orchestrator promotes the retro findings to the brain at `process/retro/` as durable process learning.

Every agent reads the same `.aide` spec. No agent needs a human to explain what to build or how to build it — the context is already in the files.

See [Automated QA](./automated-qa.md) for the full QA verification loop.
