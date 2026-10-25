# /aide:upgrade — Interactive Methodology Upgrade

> **Agent:** You are the orchestrator for this command. Do NOT delegate to a subagent.

> **CRITICAL — read this before doing anything:**
> This is a step-by-step wizard. You show ONE category at a time, ask ONE question using the `AskUserQuestion` tool with structured options, then STOP and wait.
>
> **Rules:**
> - Never show all drifted categories at once and ask "which do you want?"
> - Never offer "all" as an option
> - Every pause point MUST use `AskUserQuestion` with defined options
> - After every `AskUserQuestion`, STOP. Do not continue until the user responds.
> - The tool writes files to disk itself — you do NOT use the Write tool for file categories

Bring this project's AIDE methodology artifacts up to date with canonical by calling `aide_upgrade` and walking the user through each drifted category interactively.

## Two-call pattern

The tool uses a **two-call pattern**. The first call (no `category`) returns a lightweight summary. The second call (with `category`) writes files to disk and returns a manifest — no file content.

## Wizard flow

---

### Step 1: Call `aide_upgrade` (summary)

Call `aide_upgrade` with no arguments. The response is JSON with `framework` and `categories`. Each category has `files` (metadata only — no `canonicalContent`) and a `summary` with counts.

If all categories have `differs: 0` and `missing: 0`, skip to **Project files** below — the project's own files can still be on an older format even when the package files are current.

Otherwise, proceed to walk through drifted categories one at a time.

---

### Step 2–N: Walk through drifted categories one at a time

For each category where `differs > 0` or `missing > 0` (or, for the `brain` category specifically, any file's `status` is `"malformed"` — which doesn't increment `missing`), present ONLY that category:

- Name the category
- List which files differ or are missing (use `~` for differs, `+` for missing)
- Call `AskUserQuestion`:

```
question: "{Category} — {count} files need updating. Apply?"
header: "{Category}"
options:
  - label: "Yes, update" / description: "Write the canonical versions to disk"
  - label: "Skip" / description: "Keep current versions"
```

STOP. Wait for user response.

**If the user selects "Yes":**
1. Call `aide_upgrade` with `category` set to that category name
2. The tool writes all differs/missing files to disk itself and returns a manifest
3. Report what was updated (e.g., "Updated 2 files in .aide/docs/")

Then move to the NEXT drifted category. Present it the same way with `AskUserQuestion`.

**If the user selects "Skip":** Move to the next drifted category.

**Categories that are all `matches`:** Skip silently — don't ask about them.

---

### Special category handling

**pointer-stub:** The tool splices the canonical stub within marker boundaries, preserving user content outside the markers. This is handled by the tool during apply — just report the result.

**mcp:** The manifest includes `prescription` data. Read the existing MCP config, show what would change, and call `AskUserQuestion`:

```
question: "MCP config — the aide server entry needs updating. Merge?"
header: "MCP"
options:
  - label: "Yes, merge" / description: "Update the aide entry in .mcp.json"
  - label: "Skip" / description: "Keep current MCP config"
```

On confirmation, read the config, merge the prescription, write with the Write tool. If `malformed`, tell the user and ask how to proceed.

- **Launch mode is kept.** The prescription keeps the aide entry's current launch mode, global or local, and never switches it.
- **The local pin moves forward here.** A local npx entry not pinned to the current version gets the pinned prescription. This is how the pin moves forward.
- **Custom entries are left alone.** A custom aide entry (neither npx nor `aidemd-mcp`, e.g. a dev `node ./dist/index.js`) reports `matches` and is never offered a change.
- **Tips are information.** If a file carries a `tip`, surface it once, as information. Never turn it into a merge question.
- **The brain's launcher is not part of this step.** A legacy brain launcher is changed through `/aide:brain config`, which previews and applies it with the brain category's `brainChange: "launcher"` call.

**brain:** `.aide/config/brain.aide` is user-owned, so this category is not applied like the others. `/aide:brain config` drives it: that flow inserts missing sections with `aide_upgrade({ category: "brain" })`, previews and applies each outdated section or legacy launcher one at a time (`brainChange`, then `beforeHash`), adapts sections for a non-template backend, and seeds the brain. Do NOT call `aide_upgrade` with `category: "brain"` from this command — without `brainChange` it inserts missing sections. Skip the generic "Yes, update" question for this category and use the case below that matches the file's `status`.

- **Behind** (`status` is `differs`, with `missingSections`): the config is missing required sections. Use `AskUserQuestion`:

  ```
  question: "Your brain config is missing required sections: {missingSections joined by ", "}. Repair now?"
  header: "Brain"
  options:
    - label: "Yes, repair" / description: "Invoke /aide:brain config to add only the missing sections"
    - label: "Skip" / description: "Leave brain.aide untouched"
  ```

- **Outdated** (`status` is `differs`, with `staleSections` and/or `legacyLauncher`, alone or alongside `missingSections`): sections still carry an earlier template's text, or the brain launcher is a legacy form (`legacyLauncher` lists why: `unpinned`, `unversioned`, `older-pin`, `missing-auto-confirm`). Sections the user edited and custom launchers are never reported. Fold every kind present into one `AskUserQuestion`:

  ```
  question: "Your brain config {is missing sections: … / has outdated sections: … / uses a legacy launcher (…)}. Review now?"
  header: "Brain"
  options:
    - label: "Yes, review" / description: "Invoke /aide:brain config — it shows each change as a before/after and changes nothing without your yes"
    - label: "Skip" / description: "Leave brain.aide untouched"
  ```

- **Missing or malformed** (`status` is `missing` or `malformed`): use `AskUserQuestion`:

  ```
  question: "Brain config — .aide/config/brain.aide is {missing|malformed}. Set it up now?"
  header: "Brain"
  options:
    - label: "Yes, set up brain" / description: "Invoke /aide:brain config to create or fix brain.aide"
    - label: "Skip" / description: "Leave brain.aide untouched"
  ```

On "Yes," invoke `Skill(skill="aide:brain", args="config")`. On "Skip," move to the next category.

**ide:** Use `AskUserQuestion` with multiSelect. VS Code steps return an `instructions` field — execute it if confirmed. Zed is written by the tool directly.

---

### Project files: run the upgrader — every time

The categories above refresh what the package ships. The project's own AIDE files — intent specs, plans, todo lists, briefs — may still be on an older format. Bringing them current is the `aide-upgrader` agent's job, and it runs at the end of **every** upgrade, with no condition to check first.

1. Delegate to `aide-upgrader` (via Agent tool, `subagent_type: aide-upgrader`) in **REPORT** mode. It reads the `[migration]` entries in `.aide/docs/changelog.md` (just refreshed by the docs category) and returns what is out of date, with a suggested value and evidence for each file that needs judgment.
2. **UP TO DATE** → say so in one line and go to the summary.
3. **MIGRATIONS FOUND** → walk the user through them with `AskUserQuestion`, one decision at a time:
   - **Batch entries** (`Confirm: once, as a batch`): one question per entry — name the change and the file count. Apply or skip.
   - **Per-file entries** (`Confirm: per file`): one question per file, offering the upgrader's suggested value first (with its evidence in the description) and the other allowed values as options.
   - Never apply anything the user did not choose.
4. Delegate the approved changes to `aide-upgrader` in **APPLY** mode, listing each one exactly.
5. Relay what it changed and anything a tool refused.

---

### Final step: Summary

Report what was done:
- Files updated per category
- Categories that were already current
- Categories the user skipped
- Project files migrated by the upgrader, and any the user left as they were
