# AIDE Spec

**Autonomous Intent-Driven Engineering (AIDE)** puts intent at the center of everything. Not code, not tests, not prompts — intent. A short `.aide` doc lives next to the code it governs, and that doc is the contract. Architects plan from it. Implementors build from it. QA validates against it. When the intent changes, the code changes. When the code drifts from the intent, the code is wrong — full stop. Across a project, these docs form a **cascading intent tree**: a hierarchy of `.aide` specs rooted at the project level, each child narrowing the intent of its parent. Agents navigate the tree from root to leaf to understand the full context behind any module.

The name is a double entendre. AIDE is also an **AI Domain Expert** — the pipeline includes a domain expert agent that fills the brain with domain knowledge and a strategist agent that distills that knowledge into the spec's body sections. A human domain expert can fill the brain the same way the agent would — the strategist reads the brain regardless of who wrote to it. But domain expertise is a perk, not the point. Intent is the first-class citizen; research is just one way to inform it.

The brain can be filled by the domain expert agent, by a human domain expert, or by both. The pipeline downstream — strategist, architect, implementor, QA — treats the brain's content as authoritative regardless of the source. The developer decides what source is appropriate for the domain. The methodology applies to any domain; only the source of the brain's knowledge changes.

The research layer is optional. It runs only when the module needs domain knowledge that isn't already available — either from the user's interview context or from a prior session that already filled the brain. If the brain already has coverage, or the user holds the knowledge directly, the research phase is skipped and the strategist fills the body sections from what's available. Once the intent doc exists, the rest of the methodology treats it as authoritative regardless of how it got there.

AIDE is a three-layer model:

- **The brain holds durable knowledge.** External to the project — a vault, an MCP memory store, a team wiki. Two kinds of content live here: domain research (what the module is supposed to do in the real world) and engineering conventions (how this team writes code — the coding playbook). Different agents pull different slices: the strategist draws on domain research when filling the spec body; the architect draws on the coding playbook when translating intent into a plan. Neither bloats the repo with reference material every session has to re-read.
- **The `.aide` file holds the intent.** A short, structured brief living next to the orchestrator it governs. Strategy, outcomes, anti-patterns, domain examples. No code. This is the contract.
- **The code holds itself.** The implementation is ephemeral — if the intent changes, the code changes. The spec persists; the code is its current expression.

## File Types

| File            | Purpose                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.aide`         | The intent spec. Default and sufficient for most modules.                                                                                                                                                                                                               |
| `intent.aide`   | Same as `.aide`, renamed for disambiguation when a `research.aide` exists in the same folder.                                                                                                                                                                           |
| `research.aide` | Optional. Co-located research fallback when no external brain is available. Prefer external memory (brain, MCP) over this — every file in the repo fills context whether the agent reads it or not, and agents don't always honor "skip this" instructions.              |
| `plan.aide`     | The architect's implementation plan. Checkboxed steps the implementor executes top-to-bottom. Lives next to the `.aide` it implements. See [plan.aide spec](./plan-aide.md).                                                                                             |
| `todo.aide`     | QA re-alignment document. Captures where implementation drifted from intent, with per-issue misalignment tags and a retro section. One `todo.aide` per QA loop. See [todo.aide spec](./todo-aide.md).                                                                    |

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

Every `.aide` file follows the same structure. **Frontmatter is required, and the five body sections below are required.** Without structure, agents generate freeform specs that don't scale — repeatability comes from the template.

The canonical template lives at [AIDE Template](./aide-template.md). Agents should read the template before writing a new spec.

### Frontmatter (required)

| Field | Required | Purpose |
|-------|----------|---------|
| `scope` | Yes | The module path this spec governs. One spec, one scope. |
| `description` | Yes | One-line purpose statement. Makes ancestor chains in `aide_discover` self-contained — agents reading the chain understand what each spec governs without opening it. |
| `intent` | Yes | One paragraph, plain language: what this module is *for*. The north star every other field serves. Written so a human reading it cold understands the purpose in ten seconds. Everything in `outcomes` must be traceable back to this sentence. |
| `outcomes.desired` | Yes | The success criteria. One or more statements describing what the module should produce. The QA agent measures actual output against this list. Keep it short — every extra entry dilutes the intent. |
| `outcomes.undesired` | Yes | The failure modes. Outputs that look correct but violate intent — the green-tests-bad-output failures. The QA agent checks these explicitly even when tests pass. |
| `status` | No | Alignment state set by tooling, not by the spec writer. Omit for pending (default — no review has happened). Set to `aligned` by the aligner agent after verification; set to `misaligned` by the QA agent when drift is detected. Surfaced inline in `aide_discover` output so agents reading the ancestor chain see alignment state without opening each spec. |

**Scope, description, intent, outcomes. That's the whole contract.** `status` is the one lifecycle field that exists, added alongside the tooling that reads it — the `aide_discover` ancestor chain surfaces it inline, and `aide_validate` warns when it is absent. Its three states are implicit pending (field absent — no review has happened), `aligned` (set by the aligner agent after verification), and `misaligned` (set by the QA agent when drift is detected). The field is never set by the spec writer directly; it is a tool-verified signal. No other lifecycle fields exist — `revision` and similar state encodings are deliberately omitted. Git history tracks change; the rule "if the intent changes, it's a new spec" is the forcing function.

`intent` states the purpose; `outcomes` is the intent-engineering contract that operationalizes it — desired is the target, undesired is the tripwire. Both outcome lists are two sides of the same declaration, and both must serve the intent above them.

**YAML safety rule for outcomes:** Any `outcomes.desired` or `outcomes.undesired` list item whose text contains a colon followed by a space (`: `) must be wrapped in double quotes. YAML treats `: ` as a mapping key delimiter even inside plain scalars — backtick code spans like `` `scope: path` `` or prose like `sets status: aligned` will silently break frontmatter parsing, causing all fields to appear missing to tooling. When in doubt, quote the item.

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

### Body sections (required)

Every spec has the same five body sections. See [AIDE Template](./aide-template.md) for the full template with inline guidance.

- **`## Context`** — Why this module exists and the domain-level background an agent needs to make good decisions. No code.
- **`## Strategy`** — The synthesized approach. How this module honors its `intent` and achieves its `outcomes.desired`. Research pulled from the brain gets distilled here into decisions — specific tactics, thresholds, structural choices, and the reasoning behind each one. Write in decision form ("do X because Y"), not description form. Cite data inline. No code.
- **`## Good examples`** — Concrete domain output that illustrates success. Real output, not code. Pattern material for QA agents verifying the system's output.
- **`## Bad examples`** — Concrete domain output that illustrates failure, especially the almost-right-but-wrong cases. Expands on `outcomes.undesired` with recognizable failure material.
- **`## References`** — A flat list of brain notes the synthesis agent read during strategy writing, each as a path plus a one-line description of what was drawn from it. Its purpose is human auditability: a reviewer can trace every strategy decision back to the research that informed it without re-running the pipeline. Populated by the synthesis agent as a side effect of normal synthesis — not filled manually after the fact. Paths are not required to be valid links; the description is the fallback by design.

Additional sections (constraints, state machine, etc.) are allowed when the module needs them. These five are the floor.

### Frontmatter vs Strategy — what each layer owns

- **Frontmatter (`intent` + `outcomes`)** declares *what* the module is for and *what* counts as success or failure. It is a contract — short, falsifiable, machine-readable.
- **`## Strategy` body** answers *how* — the intent combined with research from the brain, compressed into actionable decisions the architect can turn into a plan and the implementor can execute without re-reading the sources.

If the strategy contradicts the intent, the intent wins and the strategy is wrong. If a new research finding changes the strategy but not the intent, rewrite the strategy in place. If the intent itself changes, the scope and identity of the spec have changed — consider whether it should be a new spec entirely.

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

AIDE isn't one agent doing everything. It's a pipeline of specialized agents, each with one job and a narrow set of inputs. Every stage runs in a fresh context — no agent carries conversation from a prior stage. Handoff is via files only: `.aide`, `plan.aide`, `todo.aide`, brain notes. Splitting the roles is how each agent keeps its context small enough to stay accurate.

The pipeline is driven by an **orchestrator** (`/aide`) that interviews the user, detects pipeline state from existing files, and spins up each agent in sequence. The orchestrator can resume mid-pipeline — if a user starts a new session and runs `/aide`, it picks up where the last session left off by checking which files exist.

1. **Spec Writer** (`/aide:spec`). Takes the orchestrator's delegation context — gathered from its interview with the user — and distills it into `.aide` frontmatter: `scope`, `intent`, `outcomes.desired`, `outcomes.undesired`. No body sections, no research, no code. The spec writer structures intent into a falsifiable contract; the orchestrator owns the user conversation. The frontmatter is presented to the user for confirmation before proceeding.

2. **Domain Expert** (`/aide:research`). *Optional.* Fills the brain with domain knowledge — the same role a human domain expert would play, automated. Runs only when the module requires domain knowledge that isn't already available. Ingests sources (vault notes, web search, MCP memory), synthesizes patterns, resolves conflicts, and persists the result to the brain filed by **domain** (e.g., `research/email-marketing/`), not by project — domain knowledge is reusable. If no external brain is available, falls back to a co-located `research.aide`. The domain expert never writes `.aide` files; its sole output is reusable knowledge.

3. **Strategist** (`/aide:synthesize`). Reads the brain's domain knowledge and distills it into the `.aide` body sections: `## Context`, `## Strategy`, `## Good examples`, `## Bad examples`, `## References`. Uses `aide_discover` to walk the intent tree. Every strategy decision must trace to an outcome; anything that doesn't serve the intent gets cut.

4. **Architect agent** (`/aide:plan`). Translates the complete `.aide` spec into a `plan.aide` — a checkboxed implementation plan the implementor executes top-to-bottom. Reads the `.aide` for what the module must produce, pulls the coding playbook from the brain for how this team writes code, and reads the current codebase for what already exists. Output: file placement, naming, sequencing, contracts, reuse decisions, test steps. No code. The plan is presented to the user for approval before build begins. See [plan.aide spec](./plan-aide.md).

5. **Implementor agent** (`/aide:build`). Executes `plan.aide`. Reads the plan and the `.aide` spec, writes the code, writes the tests, checks each plan step off as it completes, runs tests until green. The same agent type also runs the fix loop (`/aide:fix`) — one session per `todo.aide` item, clean context each time. If the plan is ambiguous, escalates back to the architect rather than inventing an answer.

6. **QA agent** (`/aide:qa`). Uses `aide_discover` to walk the full intent tree, compares actual output against `outcomes.desired`, checks for anything in `outcomes.undesired`, and writes a `todo.aide` re-alignment document next to the spec. Each issue traces to a specific outcome and is tagged with the pipeline stage where intent was lost (`misalignment`). Includes a `## Retro` section capturing what would have caught the issues earlier. Does not propose solutions. See [todo.aide spec](./todo-aide.md).

The fix loop cycles between QA and Implementor: QA produces `todo.aide`, the implementor fixes one item per session in clean context, QA re-validates. When all items are resolved, the orchestrator promotes the retro findings to the brain at `process/retro/` as durable process learning.

Every agent reads the same `.aide` spec. No agent needs a human to explain what to build or how to build it — the context is already in the files.

See [Automated QA](./automated-qa.md) for the full QA verification loop.
