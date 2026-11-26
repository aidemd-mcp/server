---
name: aide_scaffold
description: Creates a blank AIDE working file under its canonical name, from intent specs to plans, todo lists and the session record, never over an existing file.
---

# aide_scaffold

The single way to create an AIDE file. It owns the naming rules, so agents never pick a file name themselves.

## When to call it

Whenever a new spec, research file, plan, todo list or the session record is needed.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `directory` | Yes | The folder to create the file in. For the project root intent spec, pass `.aide` or `.`. |
| `type` | Yes | `intent`, `research`, `both` (a research and intent pair), `plan`, `todo` or `session`. |

## Naming rules it applies

- An intent spec is `.aide`, or `intent.aide` when a `research.aide` sits beside it. Creating a `research.aide` renames an existing `.aide` to `intent.aide`.
- The project root intent spec is always `.aide/intent.aide`. An old bare `.aide/.aide` with no `intent.aide` beside it is renamed, content kept.
- The session record is always `.aide/session.aide`, whatever directory is passed.
- A plan is refused in a folder with no intent spec; a `research.aide` alone does not count. Nothing is created.

## What it returns

One line per action: created, renamed, skipped or refused, naming the file.

## Guarantees

- It never overwrites. A file that already exists, filled or empty, is reported as skipped. Remove it first with `aide_cleanup` to replace it.
- New files start at their starting value: an intent spec with `alignment: unreviewed`, a plan or todo list with `status: proposed`.
