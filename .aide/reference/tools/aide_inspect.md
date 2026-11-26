---
name: aide_inspect
description: Returns a code symbol's documentation, signature and kind without opening the whole source file.
---

# aide_inspect

Lets an agent learn what a function does from its contract alone: the documentation comment, the signature and the kind of symbol.

## When to call it

When an agent knows a symbol's name, for example from an orchestrator's import list, and needs to know what it takes and returns before deciding whether to read its body.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `name` | Yes | The symbol to look up. |
| `file` | No | One file to search, when the location is already known. |

## What it returns

The symbol's documentation comment, its signature and its kind (function, type, constant and so on). It searches TypeScript and JavaScript files (`ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`).

## Guarantees

- Read-only.
