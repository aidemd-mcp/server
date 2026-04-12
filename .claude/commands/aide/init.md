# /aide:init — Interactive Project Bootstrap

> **Agent:** You are the orchestrator for this command. Do NOT delegate to a subagent.

> **CRITICAL — read this before doing anything:**
> This is a step-by-step wizard. You show ONE thing at a time, ask ONE question using the `AskUserQuestion` tool with structured options, then STOP and wait.
>
> **Rules:**
> - Never show a summary table of all categories
> - Never offer "all" as an option
> - Never present more than one category at a time
> - Every pause point MUST use the `AskUserQuestion` tool with defined options — never ask the user to respond conversationally
> - After every `AskUserQuestion`, STOP. Do not continue until the user responds.
> - Your first message should be SHORT — just the framework detection + AskUserQuestion

Bootstrap AIDE into this project by calling `aide_init` and walking the user through each step interactively. The tool returns structured JSON — you interpret it and drive the conversation.

## Two-call pattern

The tool uses a **two-call pattern** for progressive disclosure. The first call (no `category`) returns a lightweight metadata-only summary (no file content). After the user confirms a category, call again with `category=X` to get the actual content to write.

## Wizard flow

Work through these steps in order. Each step is ONE interaction — you do the action, present a brief description, then call `AskUserQuestion` with structured options and STOP.

---

### Step 1: Detect framework

Call `aide_init` with no arguments (or with a `framework` override if the user specified one). Store the full response — you'll use it across all subsequent steps.

Present a brief line about the detected framework, then call `AskUserQuestion`:

```
question: "I detected {framework}. Is that correct?"
header: "Framework"
options:
  - label: "Yes, {framework}" / description: "Continue with the detected framework"
  - label: "Cursor" / description: "Target Cursor instead"
  - label: "Windsurf" / description: "Target Windsurf instead"
  - label: "Copilot" / description: "Target Copilot instead"
```

(Omit the detected framework from the alternative options. Always include "Yes" as the first option.)

STOP. Wait for user response.

---

### Step 2–N: Walk through categories one at a time

The categories are processed in this order: `methodology`, `commands`, `agents`, `skills`.

For each category that has at least one `would-create` step, present ONLY that category with a brief description of what it contains and the file count, then call `AskUserQuestion`:

```
question: "{Category} — {count} files in {path}. Set it up?"
header: "{Category}"
options:
  - label: "Yes, create them" / description: "Create the {count} files for {category}"
  - label: "Skip" / description: "Skip {category} for now"
```

STOP. Wait for user response.

**If the user selects "Yes":**
1. Call `aide_init` with `category` set to that category name
2. Apply the `would-create` steps using the **Write tool** for each file individually
3. Create parent directories as needed (`mkdir -p`)
4. Skip `exists` and `would-skip` steps
5. Briefly confirm what was created (e.g., "Done — created 8 files in .aide/docs/")

Then move to the NEXT category. Present it the same way and call `AskUserQuestion`.

**If the user selects "Skip":** Move to the next category immediately.

**If a category is all `exists`:** Skip it silently — don't ask about it.

**Important:** Always use the Write tool to create files one at a time. Do NOT batch-write files via Bash scripts, Node scripts, or shell loops. If the tool response was large and got persisted to a JSON file on disk, use the Read tool to load it, then Write each file individually.

---

### Brain vault step

**The brain is required — there is no skip option.**

Present any `brainHints` from the initial response as named options in `AskUserQuestion`:

```
question: "AIDE needs a brain vault for research and retros. Where is yours?"
header: "Brain"
options (built dynamically from brainHints):
  - label: "Use {hint.path}" / description: "{hint.reason} ({hint.type} hint)"
  - label: "Use {hint2.path}" / description: "{hint2.reason} ({hint2.type} hint)"
  (... up to 3 hints. User can always select "Other" to type a custom path.)
```

If there are no hints, use:
```
options:
  - label: "Create new vault" / description: "I'll ask you for a path to create a new vault"
  - label: "Connect existing" / description: "I have an existing Obsidian vault to connect"
```

STOP. Wait for user response.

Once the path is resolved:
- If `status: "would-create"`, create the vault directories: `research/`, `process/retro/`, `coding-playbook/`
- If `status: "exists"`, tell the user it's already set up

---

### MCP config step

Read the project's MCP config file (`.mcp.json` or equivalent) first. Each mcp step has a `prescription` with `key` and `entry`.

Present what servers already exist and what would be added, then call `AskUserQuestion`:

```
question: "Your .mcp.json has {existing servers}. I need to add {new servers}. Merge them in?"
header: "MCP"
options:
  - label: "Yes, merge" / description: "Add the AIDE server entries alongside your existing config"
  - label: "Skip" / description: "Don't modify MCP config"
```

STOP. Wait for user response.

On confirmation, merge each prescription's `entry` under its `key` in the `mcpServers` object and write the updated config. If the file doesn't exist, create it with `{ "mcpServers": { ... } }`. **Never overwrite the entire config** — always read, merge, write.

If a step has `configMalformed: true`:

```
question: "Your .mcp.json has a JSON syntax error. How should I handle it?"
header: "MCP"
options:
  - label: "Show contents" / description: "Show me the raw file so I can fix it manually"
  - label: "Create fresh" / description: "Create a new .mcp.json with just the AIDE entries"
```

---

### IDE config step

These are optional. Use `AskUserQuestion` with `multiSelect: true`:

```
question: "Want any IDE integrations? These are optional."
header: "IDE"
multiSelect: true
options:
  - label: "Zed" / description: "Add .aide file type association to Zed settings"
  - label: "VS Code" / description: "Install aide-markdown extension for VS Code"
  - label: "Neither" / description: "Skip IDE configuration"
```

STOP. Wait for user response.

Only apply what they select.

---

### Final step: Summary

After all categories are done, give a brief summary:
- Files created (count by category)
- MCP entries merged
- Brain vault location
- IDE configuration applied (if any)

Suggest next steps: "Run `aide_discover` to see existing specs, or `/aide` to start a new pipeline."
