---
name: aide_read
description: Reads one .aide file and returns its content with its type, the other specs in its folder and the links it contains.
---

# aide_read

Reads a single spec with enough context to decide the next read in one call.

## When to call it

After `aide_discover`, to open a specific spec.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `path` | Yes | Path of the `.aide` file to read. |

## What it returns

- The file's raw content.
- Its type: intent, research, plan or todo.
- The other spec files in the same folder.
- The links found in the content: relative paths, inline references and URLs.

## Guarantees

- Read-only.
