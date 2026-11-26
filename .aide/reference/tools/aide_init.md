---
name: aide_init
description: Installs AIDE into a project one category at a time, writing new files itself and asking before anything is overwritten.
---

# aide_init

Bootstraps a project: methodology docs, the tool and hook reference, commands, agents, skills, the MCP entry, the brain config, IDE support, Claude Code hooks and the README badge.

## When to call it

When AIDE is set up in a project for the first time.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `framework` | No | `claude`, `cursor`, `windsurf` or `copilot`, to override detection. |
| `path` | No | The project root, when it is not the server's working directory. |
| `category` | No | The category to apply. Omit it on the first call. |

## How it works

1. **First call, no `category`:** a summary of every step with its name, status (`would-create`, `would-overwrite`, `would-skip`, `exists`), category and file path, but no file content. It also returns the detected framework and candidate brain folders.
2. **One call per category:** the tool writes every `would-create` file, and every approved `would-overwrite` file, and returns a manifest (`created`, `overwritten`, `exists`). The agent never sees or writes file content.

The agent walks the categories one at a time, in this order: methodology, reference, commands, agents, skills, mcp, brain, ide, hooks, readme. A category with only new files is applied without asking. A category that would overwrite a file is applied only after the user approves. Framework, MCP merge, brain folder and IDE choice are always asked.

## Exceptions

- **MCP:** the tool returns the entry to add; the agent merges it into the existing config. When the aide package is not installed globally, the step says to install it first, and nothing is merged if the install fails.
- **Brain:** the tool creates `.aide/config/brain.aide` only when it is absent, never over an existing one. Sections are added and migrated through `/aide:brain config`.
- **Session record:** the tool never writes it; its step tells the agent to call `aide_scaffold` with type `session`.
- **VS Code:** returns a command for the agent to run.

## Guarantees

- Nothing is overwritten without the user's yes.
- An existing brain config or session record is never replaced.
