---
name: aide_frontmatter
description: Reads or moves a governed frontmatter value, a spec's alignment or a plan, todo or brief's status, leaving every other byte of the file untouched.
---

# aide_frontmatter

The only writer of the two lifecycle fields AIDE governs. Agents never edit these values by hand.

## When to call it

- To read a file's governed value: pass `path` alone.
- To record a decision: an approved plan, a closed todo list, a spec checked against its ancestors.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `path` | Yes | The AIDE file, relative to the project root. |
| `field` | No | `alignment` for intent specs, `status` for plans, todo lists and briefs. Omit with `value` to read. |
| `value` | No | The new value. Omit with `field` to read. |

## The governed values

| File | Field | Values |
|---|---|---|
| Intent spec | `alignment` | `unreviewed`, `aligned`, `misaligned` |
| `plan.aide`, `todo.aide`, `brief.aide` | `status` | `proposed`, `approved`, `completed`, `abandoned` |

The session record, research specs and the brain config carry no governed value.

## Guarantees

- Only allowed moves are accepted. A refusal names the allowed next values.
- `completed` is refused while any checkbox is unchecked, and for a brief until its plan is completed.
- The tool never chooses a value; the caller decides.
