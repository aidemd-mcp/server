---
name: aide_cleanup
description: Removes a closed module's pipeline files (plan.aide, todo.aide, brief.aide), refusing while any of them is still open.
---

# aide_cleanup

The guarded eraser for pipeline scaffolding. Once a module's cycle closes, its code and intent specs are the durable record; the plan, todo list and brief go.

## When to call it

After QA passes and the retro is promoted, once each file has a closing status recorded with `aide_frontmatter`.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `path` | Yes | The module folder, relative to the project root. |
| `dryRun` | No | Report what a real call would remove, removing nothing. Never a required step. |

## What it removes, and when it refuses

- Each file it removes must be `completed` (and re-checked: every checkbox really checked) or `abandoned`. A file from before statuses existed, with every checkbox checked and no status, also passes.
- An abandoned plan takes its brief with it. With no plan in the folder, a closed `todo.aide` is removed on its own.
- It refuses a file still `proposed` or `approved`, a completed file with an open item, a `brief.aide` with no plan beside it, and a folder with no pipeline files. A refusal names each open file or item with its line, and nothing is removed.

## Guarantees

- It never removes, rewrites or reads anything else: intent specs, research specs, code and the session record are out of reach.
- It never sets or infers a status.
- It works the same on every operating system, so it can be allowed by name instead of a shell delete.
