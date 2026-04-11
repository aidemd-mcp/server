# Plan: Finish the AIDE alignment pass

**For the executing agent.** This plan finishes the `.aide` audit that brought the repo's spec tree into alignment with the canonical-reference framing: this repo is the home of the AIDE methodology, and the MCP server in `src/` is the delivery mechanism that ships the canonical docs under `docs/` to host projects through two channels (MCP handshake and `aide_init`).

The first half of the audit has already landed:

- `/.aide` written (repo-root canonical-home intent)
- `src/.aide` narrowed to specialize under the new parent
- `docs/` scaffolded with a governing `docs/.aide` and the five canonical content docs migrated from the brain (`aide-spec.md`, `aide-template.md`, `progressive-disclosure.md`, `agent-readable-code.md`, `automated-qa.md`)
- AIDE reframe applied — "Autonomous Intent-Driven Engineering" with the deliberate second reading as "AI Domain Expert"; intent is the primary driver and the research agent plays the role of the human domain expert an engineering team would otherwise need to hire

What remains is two small spec edits, three new submodule specs, and a cleanup pass on the brain vault.

## Required reading before you start

Read these in order. Do not skip — the cascading-intent chain matters, and any spec you write below must inherit correctly from the layers above it.

1. **`D:\Code\Me\aidemd-mcp\.aide`** — repo-root intent. The north star every other spec serves.
2. **`D:\Code\Me\aidemd-mcp\docs\.aide`** — governs the canonical doc set.
3. **`D:\Code\Me\aidemd-mcp\docs\aide-spec.md`** — the canonical methodology doc. You especially need the opening AI-Domain-Expert reframe, the **"Where `.aide` Files Live"** placement rule, the **"Cascading intent"** section, and the **"When to Write a `.aide`"** table.
4. **`D:\Code\Me\aidemd-mcp\src\.aide`** — the MCP server submodule spec. Note the new outcome that tool descriptions and methodology blocks must be composed from `docs/`, never hand-written.
5. **`D:\Code\Me\aidemd-mcp\src\tools\init\.aide`** — the init orchestrator spec. You will edit this.
6. **`D:\Code\Me\aidemd-mcp\src\tools\validate\.aide`** — the validate tool spec. You will edit this.

Do **not** pre-read the other tool specs (`discover`, `read`, `scaffold`, `configureIde`). They are correct under the new framing and do not need changes; reading them burns context for no benefit.

## Task 1 — Disambiguate `validate/.aide`

**Problem:** the current `src/tools/validate/.aide` describes `aide_validate` as a spec-layout health check (naming conflicts, orphaned research, missing specs, broken relative links). That is accurate and the spec describes it well. But a reader of the teaching surface may reasonably (and wrongly) conclude that `aide_validate` is the **audit agent for the automated QA loop**. It is not. The audit agent from `docs/automated-qa.md` is a slash-command agent session scaffolded by `aide_init`, not an MCP tool. `aide_validate` detects *spec-layout* drift; the audit agent detects *output* drift against `outcomes.desired/undesired`.

**Fix:** add one paragraph to the **Context** section of `src/tools/validate/.aide` that explicitly draws this line. Suggested shape (wording is yours to sharpen):

> This tool is not the audit agent from the automated QA loop. `aide_validate` detects drift in the spec *layout* — files in the wrong place, names that violate the naming rule, relative links that do not resolve. The QA-loop audit agent detects drift in the *generated output* against a spec's `outcomes.desired` and `outcomes.undesired`, and it runs as a slash-command agent session scaffolded by `aide_init`, not as an MCP tool. Both checks are useful; they operate on different artifacts and live in different layers of the pipeline. This tool owns the layout layer.

Do not expand the spec beyond this paragraph. The rest of the spec is correct.

## Task 2 — Promote slash-command scaffolding in `init/.aide`

**Problem:** `src/tools/init/.aide` currently lists "slash commands scaffolded one file per pipeline phase" as a sub-bullet of a broader outcome. Under the new framing, slash-command scaffolding is not an implementation detail — it is the delivery vector for the entire AIDE pipeline runtime in host projects. The agents that run research, spec-writing, building, auditing, and fixing in a host project only exist because `aide_init` put the slash commands there. That deserves to be a load-bearing outcome, not a step.

**Fix:** edit `src/tools/init/.aide` to promote slash-command scaffolding to its own entry in `outcomes.desired`. Suggested shape:

> - The five pipeline slash commands (research, spec, build, QA, fix) are scaffolded into the host framework's command directory, one file per phase, composed from the canonical command templates under `docs/` (or wherever the templates land per Task 3). These commands are the entire runtime of the AIDE pipeline in the host project — the audit agent, the fix agents, the builder, the research agent all exist because init put them there.

If a matching undesired tripwire makes sense (e.g., "scaffolded commands hand-written as template literals in this submodule instead of composed from `docs/`"), add it. Otherwise the single desired entry is enough. Do not otherwise expand the spec.

## Task 3 — Write specs for the shipping-dock helpers

**Problem:** three helper folders under `src/tools/init/` currently have no `.aide` files:

- `src/tools/init/writeMethodology/` — writes the AIDE methodology block into the host project's config file
- `src/tools/init/initContent/` — holds the methodology and command template content that gets installed
- `src/tools/init/scaffoldCommands/` — scaffolds the five pipeline slash commands

Under the new canonical-reference framing, these three helpers are the **shipping dock**: they are the only code paths through which the canonical docs leave this repo and land in a host project. That makes them load-bearing under the parent `src/.aide` invariant "no AIDE doctrine lives as a string literal in this submodule's source — doctrine lives in `docs/`, and this submodule is a renderer." They need specs because they govern the boundary where single-source-of-truth either survives or breaks.

The other three helpers under `init/` (`detectFramework`, `wireMcp`, `configureIde`) do **not** need new specs:

- `detectFramework/` — mechanical file-system inspection, folder-name + code self-explanatory, no domain logic. Per `aide-spec.md`'s "When to Write a `.aide`" table, helpers like this don't get specs.
- `wireMcp/` — mechanical JSON patching of `.mcp.json`, same rule.
- `configureIde/` — already has its own `.aide` carrying the Zed-vs-VS-Code strategy rationale. Do not touch.

### Step 3.1 — Read current helper implementations first

Before writing specs, read these three files to understand current behavior:

- `src/tools/init/writeMethodology/index.ts`
- `src/tools/init/initContent/index.ts`
- `src/tools/init/scaffoldCommands/index.ts`

For each, answer one question: **does it read from `docs/` at runtime, or does it hold methodology/command content as string literals in the source file?**

This matters because the specs you are about to write describe the **target state** (helpers as renderers of `docs/`), and the answer to the question above determines whether the current implementation already matches the target or whether there is an implementation gap that Task 4 needs to close.

Record your findings in a short section at the top of your PR summary titled "Shipping-dock reality vs. target." One line per helper.

### Step 3.2 — Write the three specs to the target state

Write each spec to the **target state** even if the current implementation holds content as string literals. The specs are the contract; if the code disagrees, the code is wrong and Task 4 fixes it. Do not water down the specs to match current code — that would violate `docs/.aide`'s "operational truth, not aspirational planning" rule only if the specs describe behavior *the server will never deliver*. They describe behavior the server **must** deliver under the new framing, which is a different thing.

For each spec:

- Follow `docs/aide-template.md` exactly. Frontmatter with `scope`, `intent`, `outcomes.desired`, `outcomes.undesired`, then the four body sections.
- **Cascade from the parent.** `src/tools/init/.aide` already states the init-level invariants (idempotency, independently reportable steps, etc.). Do not restate them. Each child spec should narrow to the specific dimension its helper owns and inherit the rest.
- **Decision form, not description form.** Every Strategy paragraph should state a concrete choice and the reasoning that justifies it.
- **No code in the spec.** No filenames, no function signatures, no type declarations, no worked code examples. The code documents itself.
- **Domain examples only** in the Good/Bad sections. Show what the *output* of the helper looks like — an installed methodology block, a scaffolded slash command file, a concrete doc-to-install composition — not what the TypeScript looks like.

#### Spec 3.2.A — `src/tools/init/writeMethodology/.aide`

Scope: `src/tools/init/writeMethodology`

Narrow intent to: this helper is the bridge between `docs/aide-spec.md` (and any other canonical docs that belong in the installed methodology block) and the host project's config file (`CLAUDE.md`, `.cursorrules`, whatever the detected framework uses). It reads the canonical docs at runtime, composes them into the methodology block per the framework's expected shape, and writes idempotently.

Outcomes worth capturing (your wording, not these verbatim):

- The methodology block installed in a host project is a faithful render of the canonical docs under `docs/`, with no paraphrasing, reordering, or summarization. A diff between the installed block and the concatenated source docs should show only the framework-specific wrapper (headers, marker comments), not content changes.
- The helper is idempotent. A marker comment (or equivalent) identifies an already-installed block; re-running the helper on a host project that already has the block changes nothing.
- The helper reads from `docs/` at runtime, not from hardcoded string literals. A single edit to a canonical doc propagates to every host project's next init automatically.

Undesired tripwires:

- Methodology content hand-written in this helper's source as a template literal. Any AIDE doctrine that lives in `writeMethodology/index.ts` instead of `docs/` is a single-source-of-truth violation.
- Appending to the existing methodology block on every run, producing stacked duplicates.
- Rewriting the config file from scratch, destroying user-added content outside the methodology block.

#### Spec 3.2.B — `src/tools/init/initContent/.aide`

Scope: `src/tools/init/initContent`

Narrow intent to: this helper is the **source-of-truth reader**. It knows where the canonical docs live (`docs/aide-spec.md` and siblings), reads them from disk, and exposes them to the other init helpers (`writeMethodology`, `scaffoldCommands`) in whatever shape they need. It is the only helper under `init/` that touches `docs/` directly; every other helper composes from what `initContent` returns.

This is an important architectural choice: centralizing `docs/` access in one helper means a future change to the docs folder's location or format is a one-file edit, not a scatter-shot hunt through the init tree.

Outcomes worth capturing:

- `initContent` is the sole reader of `docs/` within the init subtree. Other init helpers depend on its return values; they do not read `docs/` themselves.
- Every canonical doc `initContent` exposes is returned verbatim — no trimming, no reformatting, no summarization. Composition happens in the consuming helpers, not here.
- The helper never holds doc content as a string literal in its own source. Everything is read from disk at call time (or cached from disk at module load, depending on your design — but never baked in).

Undesired tripwires:

- Two init helpers independently reading `docs/` instead of going through `initContent`. That multiplies the single-source-of-truth surface and invites drift.
- `initContent` transforming doc content before returning it. Transforms are consumers' responsibility; centralizing them here hides the composition logic from the helpers that need to own it.
- A fallback path where `initContent` returns hardcoded string content if `docs/` is missing or unreadable. There is no "graceful degradation" here — if the canonical docs are unreadable, init must fail loudly, because shipping stale string literals is exactly the failure mode the architecture exists to prevent.

#### Spec 3.2.C — `src/tools/init/scaffoldCommands/.aide`

Scope: `src/tools/init/scaffoldCommands`

Narrow intent to: this helper scaffolds the five AIDE pipeline slash commands (research, spec, build, QA, fix) into the host framework's command directory. Each command file is composed from a canonical command template that lives in `docs/` (or, if command templates end up in a different folder such as `docs/commands/`, whatever that path is — decide as part of Step 3.1 when you see the current implementation).

Call out the open question explicitly: the canonical command template content does not yet have a confirmed home under `docs/`. If it currently lives as string literals under `initContent/`, Task 4 needs to move it to `docs/commands/` (or similar). Your spec should describe the target state: templates are Markdown files under `docs/`, read by `initContent`, composed and installed by `scaffoldCommands`.

Outcomes worth capturing:

- Exactly five slash commands are scaffolded, one per pipeline phase. The count is capped for the same reason the tool surface is capped at five — pipeline-phase dilution is a regression.
- Each command file is a faithful render of its canonical template under `docs/`. A diff between an installed command and its template should show only the framework-specific wrapper (frontmatter, marker comments), not content changes.
- The helper is idempotent. Existing command files are left untouched; only missing ones are created. A user who has customized a scaffolded command keeps their customization through re-runs.
- The command templates read from `docs/` at runtime, not from string literals. A single edit to a template propagates to every host project's next init.

Undesired tripwires:

- Command template content hand-written in this helper's source as template literals. Same failure mode as `writeMethodology` — the fix is to read from `docs/`, not to centralize the literals.
- Overwriting existing command files because "the canonical template is authoritative." It is authoritative for *new* installs. User customizations on existing files survive init; the re-run reports `exists`, not `updated`.
- A sixth slash command added because a pipeline-phase responsibility "felt different" from the existing five. Pipeline dilution at the command layer is the same regression as tool-surface dilution at the handshake layer.

### Step 3.3 — Do not create specs for `detectFramework`, `wireMcp`, or the existing `configureIde`

`detectFramework` and `wireMcp` fall below the threshold in `aide-spec.md`'s "When to Write a `.aide`" table. `configureIde` already has a spec and you should not touch it. If you feel tempted to write a fourth or fifth spec here, re-read the placement rule first. More specs is a regression if the specs don't earn their place.

## Task 4 — Implementation gap (code work, not spec work)

**This task is a follow-up PR, not part of the current spec-alignment pass.** Flag it in your PR summary but do not execute it unless explicitly asked.

If Step 3.1's "reality vs. target" check found that any of `writeMethodology`, `initContent`, or `scaffoldCommands` currently hold methodology or command content as string literals in source, those helpers need to be rewritten to read from `docs/` at runtime. This is a behavior-preserving refactor from the host-project's perspective (the installed content is unchanged if the string literals matched `docs/`), but it is a meaningful code change and deserves its own PR with its own test coverage.

The shape of that PR, for a future executor:

1. If command templates currently live as string literals under `initContent`, extract them to `docs/commands/` (one Markdown file per command: `aide-research.md`, `aide-spec.md`, `aide-build.md`, `aide-qa.md`, `aide-fix.md`). If you use `docs/commands/`, add a brief `docs/commands/.aide` governing the sub-folder as the canonical home of pipeline command templates.
2. Rewrite `initContent` to read the canonical docs and command templates from disk.
3. Rewrite `writeMethodology` and `scaffoldCommands` to consume `initContent`'s return values instead of their own literals.
4. Delete the now-unused string literals.
5. Add a test that fails if any AIDE doctrine string appears in `writeMethodology/index.ts`, `scaffoldCommands/index.ts`, or `initContent/index.ts` outside of a trivial wrapper. This is the regression guard for the single-source-of-truth invariant.

Do not do any of this in the current pass. Just document what you found in Step 3.1 so the follow-up PR has a starting point.

## Task 5 — One-way brain migration

**This task operates on the Obsidian vault, not this repo. Confirm with the user before executing** — it deletes files from the vault.

The canonical doc files have been copied to `docs/` in this repo, but the originals still sit in the brain at:

- `D:\Code\Me\my-brain\projects\aidemd-mcp\aide-spec.md`
- `D:\Code\Me\my-brain\projects\aidemd-mcp\aide-template.md`
- `D:\Code\Me\my-brain\projects\aidemd-mcp\progressive-disclosure.md`
- `D:\Code\Me\my-brain\projects\aidemd-mcp\agent-readable-code.md`
- `D:\Code\Me\my-brain\projects\aidemd-mcp\automated-qa.md`

Per `/.aide`'s "migration from the brain is a one-way move" invariant, these must be deleted (or archived into a clearly-marked `archive/` folder in the vault) on the same commit that promotes this repo's `docs/` to canonical. The brain's `aidemd-mcp` hub note (`D:\Code\Me\my-brain\projects\aidemd-mcp\aidemd-mcp.md`) stays — it is the project tracker, not canonical content — but needs two edits:

1. Rename "Autonomous Intel-Driven Engineering" to "Autonomous Intent-Driven Engineering" in the opening line, and mention the AI Domain Expert second reading.
2. Rewrite the `## Subnotes` section. The wikilinks to the five brain notes should be replaced with pointers to this repo's `docs/` folder — either file-URI links (`file:///D:/Code/Me/aidemd-mcp/docs/aide-spec.md`) or plain text notes saying "canonical docs live in the aidemd-mcp repo under `docs/`." Your call; user should review.

**Do not touch the vault without explicit confirmation from the user that this step should run.** The brain has value as a historical record and the user may want to keep archived copies somewhere other than deleted.

## Rules you must follow

- **Read cascading-intent carefully before writing any child spec.** A child spec that restates its parent is a regression. If you catch yourself typing a sentence that also appears in `src/tools/init/.aide` or `src/.aide` or `/.aide`, delete it — the parent already carries it via inheritance.
- **No code in specs.** No filenames, no type signatures, no function names, no worked code examples. Domain examples only.
- **Decisions, not descriptions.** Every Strategy paragraph states a choice and its justification. Prose that "explains how the helper works" is description; rewrite it as a decision ("we compose from `docs/` because…").
- **Task 1 and Task 2 are single-paragraph edits.** Do not expand those specs beyond what the tasks require. If you find yourself rewriting whole sections, stop — the tasks are scoped narrower than that.
- **Task 3 is three new files, nothing more.** Do not create specs for `detectFramework`, `wireMcp`, or a new version of `configureIde`.
- **Task 4 is out of scope for this pass.** Document the gap, do not fix it.
- **Task 5 is user-confirmed before execution.** Do not delete vault files without explicit go-ahead.
- **Run `npm run build` and `npm test` at the end.** The spec edits should not break the build, but a typo in YAML frontmatter will, so verify.

## Verification checklist (run before handing back)

- [ ] `src/tools/validate/.aide` Context section disambiguates spec-layout drift vs. output drift
- [ ] `src/tools/init/.aide` `outcomes.desired` has a dedicated entry for slash-command scaffolding from `docs/`
- [ ] `src/tools/init/writeMethodology/.aide` exists, scope is correct, cascades cleanly from `src/tools/init/.aide`
- [ ] `src/tools/init/initContent/.aide` exists, scope is correct, cascades cleanly
- [ ] `src/tools/init/scaffoldCommands/.aide` exists, scope is correct, cascades cleanly
- [ ] No new `.aide` created for `detectFramework` or `wireMcp`
- [ ] `configureIde/.aide` untouched
- [ ] PR summary opens with a "Shipping-dock reality vs. target" section naming whether each of the three helpers currently reads from `docs/` or holds literals
- [ ] PR summary flags Task 4 (implementation gap) as a follow-up, not executed in this pass
- [ ] PR summary flags Task 5 (vault migration) as blocked on user confirmation
- [ ] `npm run build` passes
- [ ] `npm test` passes

## If you hit something unexpected

- **If reading a current helper's source reveals that the "shipping dock" framing is wrong** — e.g., methodology content is already cleanly composed from `docs/` and there is no implementation gap — **stop and report back.** The Task 4 follow-up may not be needed, and Task 3's specs can be tightened to match current behavior without any "target state" language.
- **If `src/tools/init/.aide`'s current Strategy section already covers slash-command scaffolding in a way that makes Task 2 redundant**, flag it and skip Task 2. The goal is an accurate spec, not a spec change for the sake of activity.
- **If any spec edit breaks `npm test`** (for example, because a test snapshots `.aide` file content), stop and report — the test is coupled to spec content in a way that deserves a conversation before either the spec or the test changes.

Return a summary of: files created, files edited, the "Shipping-dock reality vs. target" findings from Step 3.1, and whether Task 4 and Task 5 were flagged or executed.
