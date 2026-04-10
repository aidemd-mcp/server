# Plan: Relocate init's private helpers under src/tools/init/

**For the executing agent.** This is a structural refactor. No behavior changes. Tests should pass unchanged at the end.

## Required reading before you start

1. **`D:\Code\Me\my-brain\projects\aidemd-mcp\aide-spec.md`** — canonical AIDE methodology. You especially need the **"Where `.aide` Files Live"** and **"Placement rule"** sections, and the **"Cascading intent"** section for child-spec inheritance rules. Read with the `Read` tool using the absolute path — the Obsidian MCP `read_note` tool is broken on this machine.
2. **`D:\Code\Me\aidemd-mcp\src\.aide`** and **`D:\Code\Me\aidemd-mcp\src\tools\init\.aide`** — the existing specs at both levels of the layer this refactor touches. The init spec already documents what init does; you need it fresh in context so you don't accidentally duplicate its content in any child specs you create.
3. **`D:\Code\Me\aidemd-mcp\src\tools\discover\index.ts`** — read briefly as a reference for the "thin orchestrator composing util helpers" pattern that init's `index.ts` should resemble after this refactor.

Do **not** read every file in `src/util/` up front. Read each helper only when you're about to move it.

## Context for this work

The earlier audit pass (closed in `todo.aide`) fixed spec placement — deleting bucket-folder specs and creating orchestrator-folder specs. A follow-up review surfaced a **structural** finding the audit did not cover: most of `src/util/` is not shared utility code. It's init's private helpers sitting in a bucket folder wearing a util label.

Concretely, these are only called by `src/tools/init/index.ts`:

- `src/util/detectFramework/` — used only by init
- `src/util/initContent/` — used only by init
- `src/util/configureIde/` — used only by init (already has its own `.aide` carrying the Zed-vs-VSCode strategy rationale)

These are actually shared and must stay in `src/util/`:

- `src/util/scan/` — used by discover + validate
- `src/util/classify/` — used by discover + read + validate
- `src/util/buildTree/` — used only by discover (Stage 3 stretch goal below; skip unless Stages 1 + 2 finish cleanly)

Additionally, `src/tools/init/index.ts` hides three inline helpers (`writeMethodology`, `scaffoldCommands`, `wireMcp`) that each deserve their own folder under the progressive-disclosure rule — each is independently idempotent, independently reportable, and has a distinct responsibility. Currently an `ls src/tools/init/` reveals none of init's substeps; after this refactor it should reveal all of them.

The AIDE placement rule (from `aide-spec.md`, read it for the precise wording) says helpers live as subfolders of the orchestrator that owns them, named after their default export, unless they are genuinely shared. This refactor applies that rule to init.

## Target folder layout

```
src/tools/init/
├── .aide                       ← already exists, do not modify
├── index.ts                    ← thin: sequence helpers, format summary
├── index.test.ts               ← update imports only
├── detectFramework/
│   ├── index.ts                ← moved from src/util/detectFramework/
│   └── index.test.ts
├── initContent/
│   ├── index.ts                ← moved from src/util/initContent/
│   └── index.test.ts
├── configureIde/
│   ├── .aide                   ← moved from src/util/configureIde/
│   ├── index.ts                ← moved from src/util/configureIde/
│   └── index.test.ts
├── writeMethodology/
│   ├── index.ts                ← extracted from current init/index.ts
│   └── index.test.ts           ← new
├── scaffoldCommands/
│   ├── index.ts                ← extracted from current init/index.ts
│   └── index.test.ts           ← new
└── wireMcp/
    ├── index.ts                ← extracted from current init/index.ts
    └── index.test.ts           ← new

src/util/
├── scan/                       ← stays
├── classify/                   ← stays
└── buildTree/                  ← stays (Stage 3 may move it; see below)
```

## Stage 1 — Extract inline helpers from init/index.ts

Current `src/tools/init/index.ts` contains three locally-defined async functions: `writeMethodology`, `scaffoldCommands`, `wireMcp`, plus two trivial utilities `fileExists` and `safeReadFile` that they share.

1. **Create `src/tools/init/writeMethodology/index.ts`.** Move the `writeMethodology` function as the default export. It takes a `configPath: string`, reads the file, checks for the marker, writes methodology if missing, returns `InitStepResult`. It depends on `getMethodology` and `getMethodologyMarker` from `initContent` — after Stage 2 the import path will be `@/tools/init/initContent/index.js`; for Stage 1 leave as `@/util/initContent/index.js` and update in Stage 2.
2. **Create `src/tools/init/scaffoldCommands/index.ts`.** Move `scaffoldCommands` as the default export. Takes `commandDir: string`, returns `InitStepResult[]`. Depends on `getCommands` from `initContent`.
3. **Create `src/tools/init/wireMcp/index.ts`.** Move `wireMcp` as the default export. Takes `mcpConfigPath: string`, returns `InitStepResult`.
4. **Shared utilities (`fileExists`, `safeReadFile`).** Decide per the AIDE **"Don't create abstractions for one-time operations"** rule: these are two-line wrappers around `access`/`readFile`. If only one helper needs them after the split, inline directly into that helper. If two or more need them, duplicate rather than extract — duplicating two lines is cheaper than introducing a shared helper folder for them.
5. **Write an `index.test.ts` for each new helper.** Look at `src/tools/init/index.test.ts` to see which test cases currently exercise each helper and split them out — do not write new test cases from scratch. The final init `index.test.ts` should only test sequencing and summary formatting; unit coverage of each helper lives with the helper.
6. **Rewrite `src/tools/init/index.ts`.** It should now import the three new helpers plus `detectFramework` and `configureZed`/`configureVscode`, sequence them, collect results, and format the summary string. Target: under 60 lines.

Run `npm test` after Stage 1 before moving on.

## Stage 2 — Move init-only helpers from src/util/ under src/tools/init/

7. **Move `src/util/detectFramework/` to `src/tools/init/detectFramework/`.** Move both `index.ts` and `index.test.ts`. Update the import in `src/tools/init/index.ts` from `@/util/detectFramework/index.js` to `@/tools/init/detectFramework/index.js`.
8. **Move `src/util/initContent/` to `src/tools/init/initContent/`.** Move `index.ts` and `index.test.ts`. Update imports in `writeMethodology` and `scaffoldCommands` (the Stage 1 extractions) to point at `@/tools/init/initContent/index.js`.
9. **Move `src/util/configureIde/` to `src/tools/init/configureIde/`.** Move `.aide`, `index.ts`, and `index.test.ts`. Update the import in `src/tools/init/index.ts` from `@/util/configureIde/index.js` to `@/tools/init/configureIde/index.js`. The `.aide` file's `scope` field must update from `src/util/configureIde` to `src/tools/init/configureIde`.
10. **`src/util/` should now contain only `buildTree`, `classify`, `scan`.** Verify with `ls`. If anything else is present, investigate before continuing.
11. **A note on configureIde's export shape.** It currently exports two named functions (`configureZed` and `configureVscode`) — no default export. That's already slightly off-pattern (the AIDE rule is one default export per folder). You have two options:
    - **Leave as-is.** Two named exports, one `.aide` spec covering both. Preserves the shared Zed-vs-VSCode rationale in one place. Minor rule violation, minor churn.
    - **Collapse into a default orchestrator.** Add a default export `configureIde(projectRoot: string, extensionsDir: string)` that calls both sub-functions in sequence and returns `InitStepResult[]`. `init/index.ts` then makes one call instead of two. This is the cleaner shape and matches the "one default export per folder" rule, but it is more churn and touches init's test.

    **Recommendation: leave as-is for this refactor.** The collapse is a good follow-up task but bundling it here muddles the diff. If you disagree after reading the spec and the existing code, document the decision in your PR summary.

12. **Update `src/tools/init/.aide` if needed.** Read it first. If its Context or Strategy section references helpers by their old `src/util/` paths, update the references. Do not expand the spec beyond what the path changes require.

Run `npm test` after Stage 2.

## Stage 3 — Optional stretch: move buildTree under discover

**Only attempt if Stages 1 and 2 pass cleanly and you have capacity.** Skip otherwise — this is the smallest-value piece of the refactor and easy to do later.

13. Move `src/util/buildTree/` to `src/tools/discover/buildTree/`.
14. Update imports in `src/tools/discover/index.ts`.
15. `src/util/` now contains only `scan` and `classify` — the two genuinely shared helpers. Run tests.

## Rules you must follow

- **No behavior changes.** This is a pure restructure. If a test was green before a file move, it stays green after.
- **Move files with their tests.** A helper's `.test.ts` moves in the same commit as its `index.ts`.
- **Update imports immediately.** Do not leave broken imports between steps. Move a file, update every import that referenced it, then move to the next file.
- **Do not create new `.aide` files for the three extracted helpers** (`writeMethodology`, `scaffoldCommands`, `wireMcp`). They are thin, single-purpose helpers — the AIDE rule is specs go on orchestrators, not on helpers. The existing `src/tools/init/.aide` carries the intent for the whole init module and is sufficient. If you feel tempted to write a spec for one of these helpers, re-read the **"When to Write a `.aide`"** table in `aide-spec.md` first — if the helper's folder name + code are self-explanatory, it doesn't get a spec.
- **Do not modify `configureIde/.aide`'s content** beyond the `scope` field update. Its Zed-vs-VSCode strategy is load-bearing and already correct.
- **Run `npm test` between stages**, not just at the end. Catching a broken import at Stage 1 is cheap; catching one at Stage 3 is expensive.
- **Do not touch `src/util/scan/`, `src/util/classify/`, `src/util/buildTree/`** in Stages 1 or 2. They are either genuinely shared (`scan`, `classify`) or reserved for a later stage (`buildTree`).
- **Do not add `src/util/.aide`.** After this refactor `src/util/` is a small bucket holding genuinely shared helpers. Bucket folders do not get specs — this was the rule we enforced in the prior audit pass.

## Verification checklist (run before handing back)

- [x] `npm run build` passes
- [x] `npm test` passes
- [x] `src/util/` contains exactly `scan/`, `classify/` (Stage 3 complete — `buildTree/` relocated under `discover/`)
- [x] `src/tools/init/` contains orchestrator + the six helper folders listed in the target layout
- [x] `ls src/tools/init/` reveals init's full architecture without opening any `.ts` file
- [x] No import in the codebase still references `@/util/detectFramework`, `@/util/initContent`, or `@/util/configureIde`
- [x] `src/tools/init/configureIde/.aide` exists and its `scope` field reads `src/tools/init/configureIde`
- [x] No new `.aide` file was created for `writeMethodology`, `scaffoldCommands`, or `wireMcp`
- [x] `src/tools/init/index.ts` is under 60 lines and contains no inline helper function definitions

## If you hit something unexpected

Do not improvise around structural surprises. Specifically:

- If a file in `src/util/` turns out to be imported by something outside init (a test helper, a script, `src/index.ts`), **stop and report back** — the "init-only" assumption this plan rests on is wrong and the plan needs revision.
- If `configureIde`'s tests depend on the helper living at `src/util/` (path-based assertions, snapshot paths), **update the test expectations, not the file location** — the move is correct, the test was coupled to the old path.
- If `npm test` fails after a move for any reason other than an obviously-broken import, **stop and report back** — a pure structural refactor should not change test outcomes.

Return a summary of: files moved, imports updated, tests adjusted, and whether Stage 3 was attempted.
