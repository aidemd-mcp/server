# /aide:upgrade — Interactive Methodology Upgrade

> **Agent:** You are the orchestrator for this command. Do NOT delegate to a subagent.

Bring this project's AIDE methodology artifacts up to date with canonical by calling `aide_upgrade` and walking the user through each category interactively.

## Flow

### 1. Call `aide_upgrade`

Call the `aide_upgrade` MCP tool with no arguments. The response is JSON with two fields: `framework` and `categories`. Each category has `files` (comparison results) and a `summary` (counts of matches/differs/missing).

### 2. Present results per-category

For each category, check the summary. Skip categories where everything matches (`differs: 0` and `missing: 0`). For categories with drifted or missing files, present them:

> **Methodology docs** (2 of 7 differ):
>   ~ .aide/docs/aide-template.md: differs
>   ~ .aide/docs/automated-qa.md: differs
>
> **Slash commands** (1 of 9 differs):
>   ~ aide:research: differs
>
> **Everything else matches** — pointer stub, agents, skills, MCP config, IDE config are all current.

Use `~` for differs, `+` for missing, `=` for matches.

### 3. Per-category confirmation

Ask the user which categories to update. They can confirm all drifted categories, some, or none. Within a category, all files update together — no per-file opt-out.

### 4. Apply confirmed categories

For each confirmed category:
- **File categories** (methodology-docs, commands, agents, skills, pointer-stub, version-metadata): Write the `canonicalContent` to the `filePath` for each `differs` or `missing` file. Create parent directories as needed.
- **MCP config**: If the MCP category has `differs` status, read the existing config, merge the `prescription` entry, and write. If `malformed`, tell the user and ask how to proceed (same as init).
- **IDE config**: Apply the changes for `differs` entries.

### 5. Summary

Report what was updated:
- Number of files updated per category
- Categories that were unchanged
- Categories the user declined

If everything was already current, say so: "All methodology artifacts match canonical. Nothing to upgrade."
