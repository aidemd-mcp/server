---
name: aide_brain
description: Read-only entry point to the brain config, returning one section of the host's config or the bundled template, the section contract, or a structural check of a draft config.
---

# aide_brain

How agents reach the brain mid-task, and how a brain config is set up, repaired or written for another backend, one decision at a time.

## When to call it

When a task needs the brain, or while `/aide:brain config` or the `aide-brain-author` skill works on the config. Not at boot: `aide_info` already reports the brain's state.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `source` | No | Which read runs: `host` (the default), `template`, `contract` or `draft`. |
| `kind` | No | Which section, by its contract marker. Omitted means `orientation`, the briefing for reaching the brain. `launcher` is accepted only with `source: "template"`. Not accepted with `contract` or `draft`. |
| `path` | With `draft` only | The project-relative path of a draft brain config. |

## What it returns

| Source | Returns |
|---|---|
| `host` | `{ status, instructions, found, purpose? }`. With `found: true`, `instructions` is the section's exact text from `.aide/config/brain.aide` and `purpose` its one-line purpose. With `found: false`, `instructions` says how to fix it: run `/aide:brain config`, add the missing section through `aide_upgrade`, or fix the file by hand. `status` is the brain's state, as in `aide_info`. |
| `template` | `{ template, purpose }`: one section (or the launcher) of the bundled template, exactly as shipped, and its purpose. The same whatever the host's config holds. |
| `contract` | `{ sections }`: every contract section in order with its marker, role (`live` or `seed`) and purpose. |
| `draft` | `{ outcome, instructions }`: `valid`, `invalid` with the fault, `absent` when no file is at `path`, or `refused` when `path` is outside the project. It checks structure, never content. |

## Guarantees

- Read-only in every mode: no call writes to disk.
- A section is returned exactly as written: no trimming, normalizing or substitution.
