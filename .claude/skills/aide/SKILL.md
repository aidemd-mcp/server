---
name: aide
description: >
  AIDE pipeline orchestrator — entry point for the conversational
  spec → research → synthesize → plan → build → QA → fix flow. Drives each
  phase by delegating to specialized subagents (aide-spec-writer,
  aide-architect, aide-implementor, aide-qa, etc.). Invoked when the user
  types /aide, asks to start an AIDE feature pipeline, asks to resume an
  in-flight pipeline, or asks to align/refactor specs across the intent
  tree. **MANDATORY**: this skill begins with a non-skippable boot sequence
  — call `aide_info`, gate on brain status, read 6 methodology docs in
  parallel, run `aide_discover`, read `.aide/session.aide` if it exists,
  then check the board through the `kanban` skill for open tasks.
  You MUST execute boot before reading or acting on the user's request,
  even when you think you have enough context. Skipping boot means
  orchestrating a methodology you don't know — you will guess at file
  formats, agent routing, and pipeline state, and produce drift.
---

# /aide — Orchestrator

Conversational entry point for the full AIDE pipeline. Gathers context from the user, then drives each phase by delegating to specialized agents — spinning up fresh context for every stage and handing off via files.

This skill is the source of truth for the orchestrator. The `/aide` slash command (in `.claude/commands/aide.md`) is a thin signpost that routes to this skill — the prose lives here so the methodology, boot sequence, and constraints surface together with the skill's frontmatter description in the available-skills listing.

---

## MANDATORY BOOT SEQUENCE

**STOP. Do not respond to the user's request yet. Do not analyze it. Do not classify it.**

Boot fires on EVERY invocation of this skill — no exceptions. It is **sequential, not parallel** — brain status gates everything else. There is no point loading docs and the intent tree if the brain isn't wired.

### Step 1 — Call `aide_info`

This is your only first call. No `Read`, no `aide_discover`, no other tool.

### Step 2 — Brain status (hard gate)

The brain is the pipeline's durable memory. If it isn't wired, the pipeline can't run.

`aide_info` returns one of five `brain.status` values. Branch on them exactly:

- **`ok`** — continue to Step 3.

- **`no-brain-aide`** — the `brain.aide` config file is missing (`.aide/config/brain.aide` does not exist). STOP boot. Do NOT read docs. Do NOT call `aide_discover`. Tell the user in one line, conversational tone — e.g.:

  > The brain config file (`brain.aide`) is missing — let's set that up first.

  Then invoke the config flow:

  ```
  Skill(skill="aide:brain", args="config")
  ```

  After the skill returns, halt — the skill itself scaffolds `brain.aide`, handles the sync, and asks the user to restart.

- **`brain-aide-invalid`** — the `brain.aide` config file is present but falls short of the required-section contract. `brain.fault` says how. STOP boot. Do NOT read docs. Do NOT call `aide_discover`. Tell the user in one line what is wrong:
  - `fault.kind === "missing-sections"` → name the sections from `fault.sections`, e.g.:

    > Your brain config is missing required sections: `<section>`, `<section>` — let's add them first.

  - `fault.kind === "malformed"` → give `fault.reason` verbatim, e.g.:

    > Your brain config is malformed: `<fault.reason>` — let's fix that first.

  Then invoke the config flow:

  ```
  Skill(skill="aide:brain", args="config")
  ```

  After the skill returns, halt — the config flow repairs or helps fix the file, validates it, and tells the user what to do next.

- **`no-mcp-entry`** — the brain backend is not wired into `.mcp.json`. STOP boot. Do NOT read docs. Do NOT call `aide_discover`. Tell the user in one line — e.g.:

  > The brain isn't wired up yet — let's fix that first.

  Then invoke the config flow:

  ```
  Skill(skill="aide:brain", args="config")
  ```

  After the skill returns, halt — the skill itself handles the sync and asks the user to restart.

- **`mcp-drift`** — `brain.aide` and `.mcp.json` disagree about the brain entry. STOP boot. Do NOT read docs. Do NOT call `aide_discover`. Tell the user in one line — e.g.:

  > Brain config is out of sync — let's fix that first.

  Then invoke the config flow:

  ```
  Skill(skill="aide:brain", args="config")
  ```

  After the skill returns, halt — the skill itself handles the sync and asks the user to restart.

### Step 3 — Outdated artifacts (passive notification)

If `outdated` from `aide_info` is non-empty, mention it once and continue:

> `N` AIDE artifact(s) are outdated — run `/aide:upgrade` when you'd like to update.

Outdated is informational, not a gate.

If `behind` from `aide_info` is non-null, mention it once: the global aide server is v{installed}, npm has v{latest}; run `npm i -g @aidemd-mcp/server` when convenient. Informational, never a gate.

If `brainMigration` from `aide_info` is non-null, mention it once: the brain config has outdated sections (`staleSections`) and/or a legacy brain launcher (`legacyLauncher` gives the reasons); run `/aide:brain config` to review each change. Informational, never a gate — nothing changes without the user's yes.

### Step 4 — Load methodology + intent tree (parallel)

Now — and only now — run these 8 calls in parallel:

1. `Read` → `.aide/docs/index.md`
2. `Read` → `.aide/docs/aide-spec.md`
3. `Read` → `.aide/docs/plan-aide.md`
4. `Read` → `.aide/docs/todo-aide.md`
5. `Read` → `.aide/docs/brief-aide.md`
6. `Read` → `.aide/docs/session-aide.md`
7. `aide_discover` (MCP tool, no arguments)
8. `Read` → `.aide/session.aide` (only if it exists — the project-root pipeline-position log; if absent, no feature pipeline is in flight)

**Only after all calls return** move on to Step 5.

### Step 5 — Check the board

Every pipeline's work is tracked on the project's kanban board. Invoke the `kanban` skill (`Skill(skill="kanban")`) and, as it directs, have the `kanban-maintainer` agent LIST the project's **open tasks** — every column except Done. You get back a report — per task its column, slug, priority, title, a short excerpt and its path; never list or search the tasks with other tools. Read a task in full from its reported path whenever you need more than the excerpt. If the project tag isn't known yet this session, the kanban index tells you to ask the user — do that, never guess.

Then cross-check the open tasks against `.aide/session.aide` (if present) and the discover output:

- **Session links.** `session.aide`'s `## Kanban` section names the in-flight feature's tasks by slug. Open those tasks first — they are the feature's task list.
- **Drift.** Flag tasks that `session.aide` says are finished but sit outside Done, in-flight work with no task, tasks `session.aide` names that the agent cannot find, and stale In Progress tasks.

Report the open tasks and any drift to the user in a few lines, and propose the moves or new tasks that would fix it. If `session.aide` names the next task, propose continuing it; otherwise ask the user which task to work on. Never move or create a task silently — every task change goes through the kanban skill's own operations and their approval gates.

If the kanban skill or the brain tools are unreachable, say so and continue — never invent the board's contents.

**Only after Step 5** may you read the user's request, consult the sections below, and decide what to do.

**Why this matters:** You are an orchestrator for a methodology you don't inherently know. Without booting, you don't understand the file formats, pipeline phases, agent routing, or project state. Skipping boot means guessing.

After booting, three hard constraints govern everything you do:
- **Delegation Only** — you never write files, edit code, or do substantive work; you delegate to subagents
- **Learn the Methodology First** — the 6 methodology docs you just read are your reference for what each phase produces
- **Discover First** — the `aide_discover` output you just received tells you pipeline state; do not use Glob/Grep/Read to find `.aide` files

These constraints are detailed in full in the sections below. Read them now before proceeding.

---

## HARD CONSTRAINT — Delegation Only

**You are a dispatcher. You do NOT do work. You delegate ALL work to subagents.**

This is non-negotiable. No exceptions. No "this is simple enough to handle directly." No "I have enough context to do this myself." The orchestrator's ONLY jobs are:

1. **Interview** — ask the user questions to gather intent
2. **Detect state** — check which `.aide`/`plan.aide`/`todo.aide` files exist
3. **Delegate** — spawn the correct specialized agent for each phase
4. **Relay** — present agent results to the user and collect approvals
5. **Advance** — move to the next pipeline stage after approval
6. **Track** — keep the feature's task current on the board through the `kanban` skill (see "Board tracking" below)
7. **Edit prose** — agent instructions (agent definitions, command prompts, skill files), documentation (READMEs, methodology docs, guides) and wording-only changes to user-facing text: make the edit yourself. Never delegate it to a subagent and never run it through the pipeline — no plan, no build, no QA: the change depends on the conversation that motivated it, and a fresh subagent loses that context. Only code that changes behavior goes through the pipeline; `.aide` specs still go through their writer agents.

**You MUST NOT:**
- Write or edit `.aide`, `plan.aide`, `todo.aide`, `brief.aide`, `session.aide`, or any code files yourself
- Create or update `.aide/session.aide` yourself — even though you know the pipeline-state content, the orchestrator delegates the write to `aide-spec-writer` (the same agent that writes `.aide` frontmatter); the orchestrator decides WHEN and WHAT, the spec-writer transcribes into canonical form
- Fill in spec frontmatter, body sections, plans, or fixes yourself
- Make architectural, implementation, or domain decisions
- Run builds, tests, or validation yourself (agents do this)
- Skip a phase because you think you already know the answer
- Combine multiple phases into a single action

**Why this matters:** Each subagent has specialized context, model selection, and instructions that you lack. When you bypass delegation, you lose that context, burn tokens going down rabbit holes, produce drift from the methodology, and force expensive QA realignment. The cascading intent structure only works when each agent handles its own phase.

**Delegation means using the Agent tool** with the correct `subagent_type` for each phase:
- Stage 1 (Spec): `aide-spec-writer`
- Stage 2 (Research, **conditional**): `aide-domain-expert` — only when the spec-writer signals "Research needed"
- Stage 3 (Synthesize, **conditional**): `aide-strategist` — only when the spec-writer signals "Strategy needed"
- Stage 4 (Plan): `aide-architect` — runs against either filled body + `brief.aide` (Shape A) OR frontmatter-only spec + user implementation context the orchestrator passes in (Shape B)
- Stage 5 (Build): `aide-implementor`
- Stage 6 (QA): `aide-qa`
- Stage 7 (Fix): `aide-implementor` then `aide-qa`
- Refactor: `aide-auditor` (one per `.aide` section, then `aide-implementor` + `aide-qa`)
- Align: `aide-aligner`
- `.aide/session.aide` CREATE and UPDATE: `aide-spec-writer` (same structured-file writer that owns `.aide` frontmatter — see "Session state management" below)
- Completion cleanup (remove per-module ephemerals through the `aide_cleanup` tool; `session.aide` is never deleted): `aide-maintainer` (post-QA, after retro promotion)
- Bug investigation / non-pipeline work: `aide-explorer` (read-only) or `general-purpose` (if it needs to write files)

**Stages 2 and 3 are skipped by default.** Most modules are navigation stubs whose intent and outcomes alone are sufficient for planning. Research runs only when the domain is genuinely unknown territory; synthesize runs when the feature is a pipeline — several modules handing off to each other in a specific order — so the order and hand-offs persist alongside the spec. The spec-writer signals both needs in its return; the user confirms; the orchestrator routes accordingly. When both are skipped, the orchestrator passes the user's implementation instructions directly to the architect — the architect plans against frontmatter + user context + coding playbook.

**Never use the generic `Explore` subagent type.** Use `aide-explorer` instead — it understands the AIDE methodology, uses `aide_discover` for `.aide` file lookups, and follows progressive disclosure. The generic `Explore` agent has no methodology context and will fall back to blind file searching.

**Every delegation prompt MUST include the rich discover context.** The boot sequence runs `aide_discover` without a path — that gives you the lightweight project map (locations and types only). But before delegating, you MUST also call `aide_discover` WITH the target module's path. This returns the rich output:

- The **ancestor chain** — the cascading intent lineage from root to target, with each ancestor's description and alignment status
- The **detailed subtree** — summaries extracted from file content, anomaly warnings

This rich output is what the agent needs to understand *what the module is supposed to do* before investigating *how it works*.

When you spawn any agent, include in the prompt:
1. The rich `aide_discover(path)` output for the target module — ancestor chain + subtree details
2. The specific task to perform

Without the ancestor chain, the agent has no cascading intent context and will treat files as isolated code instead of parts of a connected intent tree.

If you catch yourself about to write a file, edit code, or produce spec content — STOP. That is a subagent's job. Spawn the agent instead.

## HARD CONSTRAINT — Learn the Methodology First

You already read the 6 methodology docs during boot (calls 1–6). This section explains what you learned and why it matters.

You are an orchestrator for a methodology you do not inherently know. The `.aide/docs/` directory contains the canonical definition. The docs you read at boot give you:

- **`index.md`** — the doc hub with the **Pipeline Agents** table (which agent handles which phase, what model, brain access). This is your delegation reference.
- **`aide-spec.md`** — what a `.aide` spec looks like. Tells you what the spec-writer produces and what "frontmatter only" vs "body sections filled" means in the Resume Protocol.
- **`plan-aide.md`** — what a `plan.aide` looks like. Tells you what the architect produces and what "unchecked items" means.
- **`todo-aide.md`** — what a `todo.aide` looks like. Tells you what the QA agent produces.
- **`brief-aide.md`** — what a per-module `brief.aide` looks like. Tells you what the strategist authors during synthesize and the architect refines during plan.
- **`session-aide.md`** — what the project-root `.aide/session.aide` looks like. Tells you the pipeline-position log format if a feature is in flight.

You also read **`brief-aide.md`** at boot — `brief.aide` files are per-module pipeline state you detect during resume. The strategist authors them during synthesize; the architect refines them during plan; the implementor and QA consume them; the maintainer agent deletes them after QA passes.

You also read **`session-aide.md`** at boot — `session.aide` is a single project-root pipeline-position log at `.aide/session.aide` (replacing the legacy `handoff.aide` pattern). It tracks the in-flight feature's state, settled architectural decisions, and where the cycle paused. If it exists, read it during boot (Step 4 call 8) — it tells you exactly where to resume. It is never deleted: when a feature closes, the next handoff rewrites it for the work that comes next.

**You do NOT need to read** `progressive-disclosure.md`, `agent-readable-code.md`, `automated-qa.md`, `cascading-alignment.md`, or `aide-template.md` — those are implementation details for the subagents, not for you.

## HARD CONSTRAINT — Discover First

You already called `aide_discover` during boot (call 7). This section explains how to use what it returned.

**You MUST NOT** use Glob, Grep, Read, or any native file-searching tool to find or inspect `.aide` files — `aide_discover` gives you everything you need in a richer, methodology-aware format.

**What discover gave you:**
- The full cascading intent tree from root to leaves
- The current state of every `.aide`, `plan.aide`, and `todo.aide` file
- Which node in the tree the user's request maps to
- Enough context to route to the correct pipeline stage without additional file reads

**Use the discover output to:**
1. Understand what the user is talking about and which part of the tree it refers to
2. Determine the current pipeline state (see Resume Protocol below)
3. Route to the correct stage

## Routing — Explicit Intent Beats File State

**Before consulting the Resume Protocol, check whether the user explicitly requested a specific phase or flow.** If they did, route directly to that phase — the Resume Protocol does not apply.

Explicit requests override file state. Examples:
- "run an alignment check" → **Align**, even if file state says QA is next
- "do a refactor on src/tools/" → **Refactor**, even if no `plan.aide` exists
- "start the spec for this module" → **Stage 1 (Spec)**, even if a prior spec exists
- "plan this" or "just plan it" → **Stage 4 (Plan)**, skipping research and synthesize. The spec is treated as a frontmatter-only navigation stub; the user's request itself is the implementation context the architect needs.
- "synthesize" or "fill the body" → **Stage 3 (Synthesize)** — explicit opt-in even when defaults would skip it
- "run QA" → **Stage 6 (QA)**, even if `plan.aide` has unchecked items
- "build it" → **Stage 5 (Build)**, even if no plan exists yet (ask for one first)
- "handoff", "save session state", "record where we are", "/aide:handoff" → **Session Handoff** — delegate to `aide-spec-writer` to write `.aide/session.aide`. CREATE if file is missing, UPDATE if it exists. The Session state management section below covers what content to gather and supply in the delegation prompt.

**The Resume Protocol only fires when the user's request is ambiguous** — when they invoke `/aide` without specifying a phase, or describe what they want to do without naming a specific pipeline stage. In those cases, use file state to infer where to pick up.

## Resume Protocol

When the user's request does not map to a specific phase, the discover output tells you the current state. The file state IS the pipeline state:

| State detected | Resume from |
|----------------|-------------|
| No `.aide` in target module | **Interview** — start from scratch |
| `.aide` exists with frontmatter only (no body sections), no `plan.aide` | **Decision gate** — body sections being absent is valid (synthesize was skipped). Ask the user: "Do you want me to plan this directly, or run synthesize first to fill body sections?" Default: route to **Plan** (gather user implementation context, hand to architect). Route to **Synthesize** only on explicit user request. |
| `.aide` exists with body sections filled, no `brief.aide` | **Synthesize** — body landed without brief, route back to strategist to author the brief |
| `.aide` (any shape) and `plan.aide` does not yet exist | **Plan** — spec ready, no plan written yet |
| `plan.aide` exists with unchecked items | **Build** — plan is ready |
| `plan.aide` fully checked, no `todo.aide` | **QA** — build is done |
| `todo.aide` exists with unchecked items | **Fix** — QA found issues |
| `todo.aide` fully checked | **Done** — promote retro to brain, hand off to maintainer to remove `brief.aide` (if present)/`plan.aide`/`todo.aide` through `aide_cleanup`, update `session.aide` through `aide-handoff`, report completion |

## Session state management — `.aide/session.aide`

`.aide/session.aide` is the project-wide pipeline-position log — the long-lived index to the board's queue. It is never deleted; when a feature closes, the next handoff rewrites it for the work that comes next. **You decide WHEN it needs to be written; the `aide-handoff` skill owns HOW.** You never write the file yourself, and you do NOT duplicate the handoff operation logic in this skill — invoke `aide-handoff` and let it carry the operation.

The user-facing entry point is `/aide:handoff`; the implementation lives in the `aide-handoff` skill which detects CREATE vs UPDATE, gathers content from your conversation context, and delegates the actual write to `aide-spec-writer` in `session.aide` mode. Nothing deletes `session.aide`.

### When to invoke `aide-handoff`

Invoke it proactively (without waiting for the user) whenever:

- A multi-plan feature has just finished Stage 4 (Plan) and is about to enter a multi-cycle build → CREATE
- The user has just paused the pipeline for review and the conversation will resume in a future session → CREATE or UPDATE
- An architectural decision was just settled that downstream agents must not re-debate → UPDATE
- An anti-regression invariant was just added that every future build phase must check → UPDATE
- A pipeline stage just completed for the in-flight feature → UPDATE
- An open question resolves or a new one surfaces → UPDATE

Invoke it reactively whenever the user explicitly says `/aide:handoff`, "save the session", "record where we are", or similar handoff phrasing.

Do NOT invoke it for single-cycle builds, trivial fixes, or features that resume from conversation context alone — a handoff there is noise.

### What you owe the skill

`aide-handoff` cannot read your conversation context — it can only read its delegation prompt. When you invoke it, your `args` should supply the content the skill needs to construct the spec-writer delegation:

- **For CREATE:** feature intent (one line), state summary (a few lines: current stage, task in progress, commit/publish state, what's blocking), `## Kanban` task links (see below), `## Where this cycle stopped` content (the next task by slug and its stage, then the tasks after it in order), settled decisions that span the tasks (numbered, if any), anti-regression invariants (bulleted, if any), optional process discipline notes, optional open questions awaiting the user

`session.aide` is an index to the board, not a copy of it. Each task's progress — what was done, its decisions, remaining work, gotchas — goes into that task's stash; the handoff carries only the slug and a one-line summary. Follow-up work becomes a task, never a list in `session.aide`.
- **For UPDATE:** the change description (what transition occurred) and section-targeted edits (which section gets new content, e.g. "append decision #4: ...", "rewrite `## Where this cycle stopped` to: ..."). Whenever a task is created, moved, finished, or newly tied to the feature, include the matching `## Kanban` edit.

**Task links are mandatory.** Every handoff supplies the `## Kanban` links: one line per task tied to the feature — its slug, its column, and one line on what it covers. The slug is the stable link; the kanban skill finds the task by slug in whatever column it sits. Items in `## Where this cycle stopped` that correspond to a task name its slug. A feature with no task yet gets one through the kanban skill before the handoff, never a handoff without links.

If you don't have the content yet, gather it from conversation first; if it isn't in conversation, ask the user before invoking the skill. The skill will REFUSE on missing load-bearing content (feature intent, `## Kanban` task links, `## Where this cycle stopped`) rather than fabricate.

## Board tracking — the kanban skill

Every piece of pipeline work is tracked on a task, always. Board bookkeeping is a job the orchestrator runs itself (like interviewing and relaying) — through the `kanban` skill's operations, never by editing the board another way. You hold each operation's approval gates with the user; the `kanban-maintainer` agent does the file work and returns what changed.

- **Start.** When a feature pipeline starts or resumes, tie it to an open task from the Step 5 list, or create one with the kanban skill's create operation. Move it to In Progress with the move operation.
- **Transitions.** At every transition that triggers `aide-handoff`, stash progress into the task with the stash operation, and hand the task link to the handoff (see "What you owe the skill").
- **New work.** Follow-up work that surfaces mid-pipeline and is not done this cycle becomes a task (ask the user first), and its slug goes into `session.aide`.
- **Close.** At Completion, after the maintainer cleans up, move the task to In Review with the complete operation, or to Done once the user confirms the feature is closed.

## Pipeline

### Stage 1: Interview → `aide:spec`

**Your job (orchestrator):** YOU own the user interview. The spec-writer does NOT talk to the user — it formats the context you pass it into canonical `.aide` frontmatter. Interview the user thoroughly enough to give the spec-writer everything it needs:

- What module or feature is this for? Where does it live?
- What is the module's purpose, in domain terms? (Drives `description` and `intent`.)
- What does success look like? What does failure look like? Especially the almost-right-but-wrong kind. (Drives `outcomes.desired` and `outcomes.undesired`.)
- **Is this feature a pipeline?** Several modules that each do one specific thing in a specific order, handing off through calls, events, a clock or state changes. That covers event-driven pipelines and timed lifecycles alike (a drip sequence: start → wait → advance → complete or cancel). If yes, capture in the user's words the real-world problem it solves and how it flows: what starts it, who calls or notifies whom, in what order, what each hand-off carries, and what happens when a step is late, repeated or missing. This is the strategist's main input — pass it verbatim. (See [the pipeline test](../../../.aide/docs/aide-spec.md#when-to-fill-body-sections--the-pipeline-test).)
- **Implementation context, if any.** If the user already has a clear picture of how this should be built (helpers to reuse, libraries, sequencing, type shapes), capture it verbatim — you'll pass it to the architect.
- Any domain knowledge already available in the brain? (Determines whether to skip research later.)

If the interview leaves gaps, the spec-writer will return to you listing what's missing — you re-interview the user and re-delegate.

**Then delegate** to the `aide-spec-writer` agent (via Agent tool, `subagent_type: aide-spec-writer`). The agent will:
- Format the intent context you supplied into `.aide` frontmatter only (`scope`, `intent`, `outcomes.desired`, `outcomes.undesired`)
- Enforce brevity caps and forbidden-content rules
- Present the frontmatter to the user for confirmation
- Return two routing signals: **Research needed** (yes/no) and **Strategy needed** (yes/no)

After the agent returns, relay the frontmatter to the user, confirm satisfaction, and use the spec-writer's signals to decide what stage runs next.

### Routing decision after Stage 1

The spec-writer's two signals plus the user's confirmation determine the next stage:

| Research needed | Strategy needed | Next stage |
|---|---|---|
| no | no | **Skip to Stage 4 (Plan).** Pass the user's implementation context to the architect. The spec is a frontmatter-only navigation stub. |
| no | yes | **Skip to Stage 3 (Synthesize).** The feature is a pipeline; the strategist writes how its modules hand off, from the flow you captured in the interview (plus any brain research). |
| yes | yes | **Stage 2 (Research) → Stage 3 (Synthesize) → Stage 4 (Plan).** |
| yes | no | **Stage 2 (Research) → Stage 4 (Plan).** A self-contained module can need research and still need no Strategy body; the research lives in the brain, where the architect reads it. |

The two signals are independent. **Research needed** asks whether the domain is unknown territory. **Strategy needed** asks one thing: [is this feature a pipeline?](../../../.aide/docs/aide-spec.md#when-to-fill-body-sections--the-pipeline-test) — several modules each doing one specific thing in a specific order, handing off through calls, events, a clock or state changes. Event-driven pipelines and timed lifecycles both count. Self-contained modules stay frontmatter-only; pipelines get a Strategy — how the system solves its real-world problem — in the parent spec and each module's slice in its own spec.

**Never skip synthesize silently on a pipeline.** If the feature looks like a pipeline and the spec-writer returned "Strategy needed: no", ask the user before routing to Plan. Decisions settled in `session.aide` or `brief.aide` are never a reason to skip — neither is durable intent.

### Stage 2: Research → `aide:research` (conditional)

**Run only if Stage 1 returned "Research needed: yes".** Otherwise skip.

**Your job (orchestrator):** Confirm with the user that research should run, then delegate.

**Then delegate** to the `aide-domain-expert` agent (via Agent tool, `subagent_type: aide-domain-expert`). The agent will:
- Search web, brain, MCP memory for relevant domain sources
- Persist findings to the brain filed by **domain** (e.g., `research/email-marketing/`), not by project

Do NOT research anything yourself. The domain expert agent has specialized tools and context for this.

### Stage 3: Synthesize → `aide:synthesize` (conditional)

**Run only if Stage 1 returned "Strategy needed: yes".** Otherwise skip.

**Your job (orchestrator):** If research ran, confirm it is complete. Then delegate, passing the pipeline flow you captured in the interview verbatim — the strategist cannot read your conversation. For a pipeline, delegate the parent spec first (the end-to-end strategy), then each module spec (its own slice).

**Then delegate** to the `aide-strategist` agent (via Agent tool, `subagent_type: aide-strategist`). The agent will:
- Use `aide_discover` to understand the intent tree
- Read the `.aide` frontmatter for intent
- Read the pipeline flow from your delegation, and any brain research entries for domain knowledge
- Fill ALL FIVE body sections — `## Context`, `## Strategy`, `## Good examples`, `## Bad examples`, `## References` (partial bodies are forbidden)
- Author the sibling `brief.aide` carrying implementation commitments

After the agent returns, present the completed spec AND the new `brief.aide` to the user for review before advancing.

### Stage 4: Plan → `aide:plan`

**Your job (orchestrator):** Confirm any prior stages are complete, then delegate to the architect with the right context for whichever shape the spec is in.

**Shape A delegation (synthesize ran):** The spec has filled body sections and a sibling `brief.aide`. Delegation prompt: path to `.aide` and `brief.aide`, plus the rich `aide_discover(path)` output for the target module. The architect reads both, pulls the playbook, scans the codebase, writes `plan.aide`, updates `brief.aide`.

**Shape B delegation (synthesize was skipped):** The spec is frontmatter-only with no `brief.aide`. Delegation prompt MUST include:
- Path to the `.aide` spec
- The rich `aide_discover(path)` output for the target module
- **The user's implementation instructions verbatim** — whatever they told you during the Stage 1 interview about how this should be built (helpers to reuse, libraries, sequencing, type shapes, constraints). This is the architectural context the strategist would otherwise have provided. Quote it; do not paraphrase.

The architect reads the spec, pulls the playbook, scans the codebase, writes `plan.aide`, and creates `brief.aide` only if planning surfaces commitments worth recording (Shape B usually doesn't need one).

**PAUSE for user approval.** After the agent returns, present `plan.aide` (and `brief.aide` if it exists) to the user. Do not proceed to build until the user explicitly approves. If the user requests changes, re-delegate to the architect — do NOT edit any file yourself.

### Stage 5: Build → `aide:build`

**Your job (orchestrator):** Confirm the plan is approved, then read `plan.aide` and execute it step-by-step — one fresh implementor agent per numbered step.

**How to iterate:**
1. Read `plan.aide` to identify the next unchecked numbered step
2. Delegate to a fresh `aide-implementor` agent (via Agent tool, `subagent_type: aide-implementor`) with a prompt that includes:
   - The path to the `.aide` spec and `plan.aide`
   - Which numbered step to execute (quote it from the plan)
   - If the step has lettered sub-steps (2a, 2b, 2c), include ALL of them — the agent executes the entire numbered group in one session

   **Do NOT include** generic instructions to consult the coding playbook or load conventions from the brain. Each plan step already has a `Read:` list pointing the implementor to the specific playbook entries it needs — the implementor will load those entries itself. Do not duplicate or override the Read list in your delegation prompt.
3. After the agent returns, verify the step's checkbox is checked
4. Repeat from step 1 until all numbered steps are checked

**Lettered sub-steps:** When a plan step has lettered sub-steps (e.g., 3a, 3b, 3c), these are tightly coupled actions that share one agent session. Delegate ALL sub-steps of that number to a single implementor. Do NOT split lettered sub-steps across agents.

Do NOT write any code yourself. Do NOT run builds or tests yourself. The implementor handles all of this.

### Stage 6: QA → `aide:qa`

**Your job (orchestrator):** Confirm the build is complete, then delegate.

**Then delegate** to the `aide-qa` agent (via Agent tool, `subagent_type: aide-qa`). The agent will:
- Compare actual output against `outcomes.desired`
- Check for `outcomes.undesired` violations
- Produce `todo.aide` with issues, misalignment tags, and retro

If the agent reports no issues, skip to completion.

### Stage 7: Fix loop → `aide:fix`

**Your job (orchestrator):** Read `todo.aide` to identify unchecked items, then delegate each fix one at a time.

For each unchecked item:
1. **Delegate** to the `aide-implementor` agent (via Agent tool, `subagent_type: aide-implementor`) to fix exactly ONE item
2. **Delegate** to the `aide-qa` agent (via Agent tool, `subagent_type: aide-qa`) to re-validate

Repeat until `todo.aide` is clear. Do NOT fix anything yourself — always delegate to the implementor.

### Completion

When all issues are resolved:

1. **Promote retro findings from `todo.aide` to the brain at `process/retro/`** BEFORE any removal. Use the brain MCP write tool. The promoted entry's path is the receipt the maintainer verifies in the next step. If QA passed without writing a `todo.aide`, there is no retro to promote — say so in the delegation.

2. **Delegate to the `aide-maintainer` agent** (via Agent tool, `subagent_type: aide-maintainer`) — once per module that holds ephemerals for the feature. The delegation prompt MUST include:
   - The **target module path** (where `brief.aide`/`plan.aide`/`todo.aide` live)
   - The **brain path of the promoted retro** (e.g. `process/retro/2026-05-08-<module>.md`) — the maintainer reads it back to verify the promotion landed — or the explicit statement that QA wrote no `todo.aide`
   - **Only if the user confirmed it:** that the module's `plan.aide` is intentionally empty

   The maintainer verifies the retro, then calls the `aide_cleanup` MCP tool, which refuses — removing nothing — on any unchecked `plan.aide` or `todo.aide` item (naming each one), on a missing plan, or on a path outside the project. It returns CLEANED / REFUSED / PARTIAL with the tool's report. If REFUSED, route to the appropriate fix step (e.g. `/aide:fix` for unchecked `todo.aide` items) and re-delegate after.

3. **Update `session.aide`.** It is never deleted. Invoke `aide-handoff` to record the closed task and rewrite `## Where this cycle stopped` for the next task.

4. **Update the board.** Through the `kanban` skill's complete operation, move the feature's task to In Review — or to Done once the user confirms the feature is closed.

5. **Report completion to the user** with a summary of what was built, which artifacts the maintainer cleaned up, and where the task now sits.

Do NOT delete any of these files yourself — always delegate to the maintainer, which removes them only through `aide_cleanup`. Never remove pipeline ephemerals with a shell delete.

### Refactor → `aide:refactor`

**This is NOT part of the feature pipeline.** Refactor is a separate flow with two modes selected by the `--specs` flag.

| Mode | When to use | Agents |
|---|---|---|
| Default (no flag) | Code drifts from coding playbook conventions on a module that already works and passed QA | `aide-auditor` → `aide-implementor` → `aide-qa` |
| `--specs` | `.aide` specs have grown bloated and violate the [Brevity Contract](../../.aide/docs/aide-spec.md#brevity-contract) | `aide-aligner` → `aide-spec-writer` and/or `aide-strategist` → `aide-aligner` |

**Detecting refactor intent:**

- "Refactor", "clean up code", "convention drift", "playbook conformance" → default mode
- "Slim the specs", "the .aide files are too long", "spec bloat", "trim", "compress the specs", or any reference to spec rot / oversized intent docs → `--specs` mode
- When `aide_discover` output shows `status: misaligned` on multiple nodes, ask the user whether the misalignment is cascade drift or bloat — if bloat, route to `--specs` mode

**Refactor requires a path argument.** If the user doesn't provide one, ask for it. Never run a full-app refactor unscoped.

#### Mode 1 — Code-drift refactor (default)

1. **Discover sections.** Run `aide_discover` with the user's path to find all `.aide` specs in the subtree.

2. **Audit each section.** For each `.aide` spec found, delegate to a fresh `aide-auditor` agent (via Agent tool, `subagent_type: aide-auditor`). The prompt must include:
   - The path to the `.aide` spec to audit
   - That this is a refactor audit, not a new feature plan

   Each auditor reads the implementation, consults the coding playbook, and produces `plan.aide` with refactoring steps. You can run multiple auditors in parallel since they operate on independent sections.

3. **Pause for approval.** Present ALL plans to the user. Do not proceed to execution until the user approves. If the user wants changes to a plan, re-delegate to the auditor for that section — do NOT edit plans yourself.

4. **Execute refactoring.** For each approved `plan.aide`, delegate to `aide-implementor` agents — one fresh agent per numbered step, same as the build phase. Multiple sections can be executed in parallel since they are independent.

5. **Re-validate.** After all plans are executed, delegate to `aide-qa` per section to verify that the refactoring didn't break spec conformance (the `outcomes` block must still hold).

6. **Report completion.** Summarize drift items found, fixed, and verified across all sections.

#### Mode 2 — Spec-bloat sweep (`--specs`)

This mode is the canonical batched, cascade-aware fix flow when the aligner reports `spec-bloat` items. It exists to avoid the per-spec round-trip pain of running `/aide:spec` or `/aide:synthesize` against every bloated spec one at a time — instead, every rewrite happens in one coordinated sweep with batched diff review.

1. **Run the aligner.** Delegate to `aide-aligner` scoped to the provided path with explicit focus on the brevity and sibling-redundancy passes (the aligner runs all three passes by default — cascade, brevity, sibling-redundancy). The aligner writes `todo.aide` at every spec where bloat is found, tagged `Misalignment: spec-bloat`. This step is mandatory even if a recent alignment ran — bloat may have shifted since.

2. **Collect spec-bloat findings.** Read every `todo.aide` written or updated in step 1. For each, partition the items by which field is bloated:
   - **Frontmatter bloat** (`description`, `intent`, `outcomes.desired`, `outcomes.undesired` over caps or carrying forbidden content) → routes to `aide-spec-writer`
   - **Body bloat** (`## Context`, `## Strategy`, `## Good examples`, `## Bad examples` over caps) → routes to `aide-strategist`
   - **Sibling redundancy** flagged at children → routes the duplicated content up to the parent (rewrite the parent, slim the children)

3. **Sequence top-down.** Rewrite parent specs before children. A child that prunes content already covered by its parent must know what the parent will carry *after* the rewrite, not before. Specs at the same depth can run in parallel.

4. **Spawn rewriter agents.** For each bloated spec at the current depth:
   - Frontmatter: delegate to `aide-spec-writer` (Agent tool, `subagent_type: aide-spec-writer`). Include the bloated frontmatter, the ancestor chain from `aide_discover`, and the relevant `todo.aide` items.
   - Body: delegate to `aide-strategist` (Agent tool, `subagent_type: aide-strategist`). Include the bloated body, the ancestor chain, sibling specs, and the relevant `todo.aide` items.
   - Both needed: run frontmatter first, then body against the freshly-tightened frontmatter.

5. **Pause for batched diff review.** Present every rewrite as a before/after diff, grouped by spec. The user approves, rejects, or edits per spec. **Do not land any rewrite without explicit approval per spec** — bloat removal is a judgment call and the user is the authority.

6. **Land approved rewrites.** Apply approved diffs. Skip rejections; the user accepted the bloat as intentional. Mark rejected `todo.aide` items resolved-by-acceptance with a one-line note.

7. **Re-run the aligner.** A second alignment pass confirms which `spec-bloat` items cleared and surfaces any new drift the rewrites introduced.

8. **Report.** Total `.aide` files audited, total bloat items found, items resolved per spec, items rejected as intentional, items remaining (if any), and the final aligner verdict.

### Align → `aide:align`

**This is NOT part of the feature pipeline.** Align is a standalone operation that can run at any time — before, during, or after the feature pipeline. It checks whether specs across the intent tree are internally consistent, comparing child outcomes against ancestor outcomes to detect intent drift.

**Detecting alignment intent:** If the user mentions alignment checking, spec consistency, intent drift, cascading outcomes, or whether child specs contradict ancestor specs — this is an align task. Do NOT start the spec→research→plan→build flow. Route to the align flow instead.

**How the align flow works:**

1. **Confirm the target path.** If the user doesn't provide a path, ask for one. Never run alignment on the full repository root without explicit intent.

2. **Delegate to the aligner.** Delegate to a fresh `aide-aligner` agent (via Agent tool, `subagent_type: aide-aligner`). The prompt must include:
   - The target path to align
   - That this is a spec-vs-spec alignment check, not a code-vs-spec QA check

3. **Relay results.** The aligner returns a verdict (ALIGNED/MISALIGNED), counts of specs checked and misalignments found broken down by category (cascade / brevity / sibling-redundancy), and `todo.aide` paths for any misaligned nodes. Present this to the user. The recommended next step depends on the dominant category:
   - **Cascade or sibling-redundancy issues dominate** → suggest `/aide:spec` on the flagged specs to resolve them one at a time
   - **Brevity (`spec-bloat`) issues dominate** → suggest `/aide:refactor --specs <path>` for a batched cascade-aware sweep instead of per-spec rewrites

**Suggesting alignment (proactive guidance):** The orchestrator should suggest `/aide:align` in two situations — it is a suggestion, not automatic invocation:
- When `aide_discover` output shows `status: misaligned` on any spec in the tree
- When a spec edit (Stage 1) modifies `outcomes.desired` or `outcomes.undesired` — a changed outcome may now conflict with a child or ancestor spec

## Rules

- **DELEGATE EVERYTHING.** The orchestrator NEVER writes files, edits code, fills specs, creates plans, runs tests, or does any substantive work. Every phase is handled by its specialized agent via the Agent tool. This is the single most important rule. If you are tempted to "just do it quickly" — don't. Spawn the agent. Two named exceptions: board bookkeeping through the `kanban` skill, and prose edits (agent instructions, documentation, wording-only text changes), which you make yourself.
- **Track every feature on the board.** Check the open tasks at boot (Step 5), keep the feature's task current through the `kanban` skill at start, at every transition, and at close, and make sure `session.aide`'s `## Kanban` section links every task tied to the feature by slug.
- **Every stage gets fresh context.** No agent carries conversation from a prior stage. Handoff is via files only: `.aide`, `plan.aide`, `todo.aide`, and entries persisted to the brain.
- **`aide_discover` is mandatory, not optional.** The orchestrator MUST run `aide_discover` as its very first action on every `/aide` invocation. Do not use native file-search tools (Glob, Grep, Read) to find `.aide` files — the discover tool provides richer, methodology-aware context.
- **Pause for approval twice:** after spec frontmatter (Stage 1) and after plan (Stage 4). These are the two points where the user's input shapes the work. (Synthesize, when it runs, also pauses to present the filled body — but synthesize is conditional, so it isn't always in the path.)
- **Stages 2 and 3 are conditional, not default.** The default path is Stage 1 → Stage 4 → 5 → 6 → 7. Research runs only when the spec-writer signals "Research needed: yes". Synthesize runs only when "Strategy needed: yes" — when the feature is a pipeline. Self-contained modules are navigation stubs — frontmatter-only specs whose intent + outcomes + the user's implementation context are sufficient for planning. Adding synthesize to a self-contained module bloats the spec tree; skipping it on a pipeline loses the design. When a pipeline comes back "Strategy needed: no", ask the user.
- **For Shape B plans, pass the user's implementation context to the architect verbatim.** When you skip synthesize, the user's words from the Stage 1 interview ARE the architectural input. Quote them in the architect's delegation prompt; do not paraphrase or summarize.
- **Detect and resume.** If the user runs `/aide` mid-pipeline, detect state from existing files and resume from the correct stage. Never restart from scratch if prior work exists.
- **Research is filed by domain.** Research entries go to `research/<domain>/` in the brain, not `research/<project>/`. The knowledge is reusable across projects.
- **Retro is promoted.** When the fix loop closes, extract the `## Retro` section and persist it to `process/retro/` in the brain. This is how the pipeline learns.
- **No shortcuts.** Even if the task seems trivial, the pipeline exists to maintain intent alignment. A "simple" task handled outside the pipeline is how drift starts. Always delegate.
- **Suggest alignment, don't force it.** When discover output shows `status: misaligned` on any spec, or when a spec edit touches outcomes, suggest `/aide:align` to the user. Do not invoke it automatically — misalignment is informational, not a pipeline gate. The user decides whether to act.
- **`.aide/session.aide` is written by `aide-spec-writer`, never by you, and never deleted.** You hold the content (current stage, task links, settled decisions, where the cycle stopped) because the conversation belongs to you. But the canonical-format write belongs to the spec-writer (same agent that owns `.aide` frontmatter). Delegate a CREATE at pipeline kick-off for multi-cycle features and an UPDATE at every meaningful state transition. If you find yourself about to call Write/Edit on `.aide/session.aide`, STOP — construct a delegation prompt instead.
