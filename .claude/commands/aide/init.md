# /aide:init — Interactive Project Bootstrap

> **Agent:** You are the orchestrator for this command. Do NOT delegate to a subagent.

Bootstrap AIDE into this project by calling `aide_init` and walking the user through each step interactively. The tool returns structured JSON — you interpret it and drive the conversation.

## Flow

The tool uses a **two-call pattern** for progressive disclosure. The first call returns a lightweight metadata-only summary (no file content). After the user confirms a category, call again with `category=X` to get the actual content to write.

### 1. Call `aide_init` (summary)

Call `aide_init` with no arguments (or with a `framework` override if the user specified one). The response is JSON with `framework`, `steps` (metadata only — no `content` fields), and `brainHints`. This response is small and easy to read.

### 2. Confirm framework

Tell the user which framework was detected and ask them to confirm. If they want a different framework, re-call `aide_init` with the `framework` parameter set to their choice.

### 3. Present methodology, commands, agents, skills

Group the steps by category. For each category that has `would-create` steps, summarize what will be created. For categories that are all `exists`, note they're already set up. Ask the user if they want to proceed with the creates.

### 4. Fetch and apply confirmed categories

For each category the user confirms, call `aide_init` again with `category` set (e.g. `category: "methodology"`). This returns only that category's steps, now with full `content` populated.

Apply the `would-create` steps yourself:
- For file steps: write the `content` to the `filePath`
- Create parent directories as needed (`mkdir -p`)
- Skip `exists` and `would-skip` steps

### 5. Brain vault interview

**The brain is required.** AIDE needs a vault for research and retros — there is no skip option.

Present any `brainHints` as suggestions:
- `env` hint: "Found AIDE_BRAIN_PATH pointing to {path}"
- `sibling` hint: "Found a vault at {path} (sibling directory)"
- `conventional` hint: "Found a vault at {path}"

Ask the user: "Where is your brain vault?" Offer the hints as defaults they can accept, or let them type a custom path.

Once the user confirms a path:
- If the brain step has `status: "would-create"`, create the vault directories: `research/`, `process/retro/`, `coding-playbook/`
- If `status: "exists"`, tell the user the vault is already set up

### 6. MCP config — merge prescriptions

Find all steps with `category: "mcp"`. Each has a `prescription` with `key` and `entry`.

Read the project's MCP config file (`.mcp.json` or equivalent). If it exists and parses:
- Show the user what servers are already configured
- Show what entries will be added (the prescriptions)
- On confirmation, merge each prescription's `entry` under its `key` in the `mcpServers` object
- Write the updated config

If the file doesn't exist, create it with `{ "mcpServers": { ... } }` containing the prescribed entries.

If a step has `configMalformed: true`:
- Tell the user the config file has a JSON syntax error
- Show them the raw contents
- Ask whether to fix it or create a fresh config with the required entries

**Never overwrite the entire config.** Always read, merge, write.

### 7. IDE config (optional)

Present IDE steps and ask the user which they want:
- Zed: `.aide` file type association
- VS Code: aide-markdown extension

Only apply what they confirm. These are optional — the user can decline.

### 8. Summary

Report what was done:
- Files created
- MCP entries merged
- Brain vault location
- IDE configuration applied

Suggest next steps: "Run `aide_discover` to see existing specs, or `/aide` to start a new pipeline."
