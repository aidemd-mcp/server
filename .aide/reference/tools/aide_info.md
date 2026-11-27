---
name: aide_info
description: Boot-time report telling the orchestrator whether the server is behind, whether the project's AIDE files or hooks are out of date, and whether the brain is wired.
---

# aide_info

The first call of every `/aide` session. It reads the project and returns four independent findings; the orchestrator branches on each one separately.

## When to call it

At the start of every `/aide` session, before reading docs or the intent tree. Call it again after fixing the brain config to re-check.

## Parameters

None. It works on the server's project root.

## What it returns

| Field | Kind | Meaning |
|---|---|---|
| `brain` | Hard gate | `{ status, name?, fault?, hints }`. `status` is `ok`, `no-brain-aide` (no `.aide/config/brain.aide`), `brain-aide-invalid` (`fault` says which sections are missing or why it is malformed), `no-mcp-entry` (`.mcp.json` has no `brain` entry) or `mcp-drift` (the config and `.mcp.json` disagree). Anything but `ok` stops the pipeline until `/aide:brain config` fixes it. `hints` lists candidate brain folders. |
| `behind` | Soft notice | Null, or `{ installed, latest, launch, versionsBehind, highlights }` when the running server is older than the latest published release. `launch` (`global` or `local`) picks the remedy: a global `npm i -g`, or installing the new version into the npx cache and moving the project's pin with `aide_upgrade`. `highlights` holds up to three one-line notes. |
| `outdated` | Soft notice | The keys of installed AIDE files that are older than the version this project runs, judged against the running server, never against npm. The key `hooks` means the project's Claude Code hooks are missing from this machine's local settings, still sit in the shared `.claude/settings.json`, differ from what this server installs, or can't be read. Empty when everything is current. |
| `brainMigration` | Soft notice | Null, or `{ staleSections, legacyLauncher }` when the brain config has sections from an earlier template or an outdated launcher. Suggests `/aide:brain config`. |

It also returns `serverVersion`, the running server's version.

## Guarantees

- Read-only: it never writes a file.
- It never checks whether the brain folder exists on disk; brain state comes only from comparing the brain config with `.mcp.json`.
- An offline version check passes silently: `behind` is null, never an error.
