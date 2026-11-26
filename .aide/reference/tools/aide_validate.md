---
name: aide_validate
description: Health check for the spec layout, reporting orphaned or missing specs, plans with no spec, naming conflicts, broken links and frontmatter problems.
---

# aide_validate

Finds layout drift in the intent tree before it decays.

## When to call it

Whenever the spec layout might have drifted: after moving folders, after writing specs, or as a periodic check.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `path` | No | A folder to check. Omit it to check the whole project. |

## What it reports

| Finding | Meaning |
|---|---|
| Orphaned spec | A spec whose folder and subfolders hold no code, only AIDE files, Markdown and dot-files. The project root intent spec is never orphaned. |
| Plan without a spec | A `plan.aide` with no intent spec beside it. Write the folder's spec; never delete the plan. |
| Missing spec | An orchestrator with three or more helper imports and no spec. |
| Naming conflict | `.aide` and `intent.aide` in the same folder. |
| Broken link | A link in a spec that points at nothing. |
| Orphaned research | A `research.aide` with no intent spec beside it. |
| Missing description | A spec with no `description` in its frontmatter. |
| Unparseable frontmatter | A file whose frontmatter cannot be read. |
| Missing or invalid alignment | An intent spec without `alignment`, or with a value other than `unreviewed`, `aligned` or `misaligned`. |

## Guarantees

- Read-only: it reports, it never fixes.
