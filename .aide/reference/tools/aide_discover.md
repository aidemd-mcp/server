---
name: aide_discover
description: Maps where the project's .aide specs live, or gives one module's ancestor chain and subtree, so agents read intent before code.
---

# aide_discover

The map of the cascading intent tree. Agents use it instead of searching the file system for `.aide` files.

## When to call it

- Without a path, once at boot, to see where specs live.
- With a module's path, before working on that module or delegating work on it.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `path` | No | A folder to drill into. Omit it for the project-wide map. |

## What it returns

- **Without `path`:** a light map of the whole project: every spec file's location, its type tag (intent, research, plan, todo; a plan or todo tag carries its status, e.g. `[plan: approved]`) and each spec's one-line description. Only the head of each file is read.
- **With `path`:** first the ancestor chain, every spec from the project root down to that folder with its description and alignment (`aligned` or `misaligned` when set), then the folder's subtree with summaries and warnings, such as an orchestrator with several helpers and no spec.

## File types it recognizes

| File | Meaning |
|---|---|
| `.aide` | Intent spec (the default name). |
| `intent.aide` | Intent spec, used when a `research.aide` sits in the same folder. |
| `research.aide` | Research gathered for the module. |
| `plan.aide` | The architect's implementation plan. |
| `todo.aide` | QA's list of where the code drifted from intent. |

A folder never holds both `.aide` and `intent.aide`.

## Guarantees

- Read-only.
