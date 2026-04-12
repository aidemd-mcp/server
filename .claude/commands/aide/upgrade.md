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

If all categories have `differs: 0` and `missing: 0`, tell the user everything is current and stop.

Otherwise, proceed to walk through drifted categories one at a time.

---

### Step 2–N: Walk through drifted categories one at a time

For each category where `differs > 0` or `missing > 0`, present ONLY that category:

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

**ide:** Use `AskUserQuestion` with multiSelect. VS Code steps return an `instructions` field — execute it if confirmed. Zed is written by the tool directly.

---

### Final step: Summary

Report what was done:
- Files updated per category
- Categories that were already current
- Categories the user skipped
