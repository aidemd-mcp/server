---
name: aide_upgrade
description: Finds where the project's AIDE files have drifted from the version it runs and applies, one category at a time, only what the user confirms.
---

# aide_upgrade

Keeps a project's AIDE infrastructure in step with the server it runs. It never touches the user's code or their `.aide` specs.

## When to call it

When the user asks to update, sync or refresh AIDE, or when `aide_info` reports files or hooks as outdated. `/aide:upgrade` runs it.

## Parameters

| Name | Required | Meaning |
|---|---|---|
| `category` | No | The category to apply. Omit it for the summary. |
| `framework` | No | `claude`, `cursor`, `windsurf` or `copilot`, to override detection. |
| `path` | No | The project root, when it is not the server's working directory. |
| `targetVersion` | No | An exact published version (`x.y.z`), to move a pinned npx entry's version. Only with no category or with `mcp`. |
| `brainChange` | No | Brain only: one stale section's marker, or `launcher`, to preview that one change. |
| `beforeHash` | No | Brain only: the hash a preview returned, to apply that change. |

## Categories

pointer-stub, methodology-docs, version-metadata, reference, commands, agents, skills, mcp, ide, readme, brain, hooks.

## How it works

1. **First call, no `category`:** every category with its files, their status (`matches`, `differs`, `missing`) and counts, but no content.
2. **One call per confirmed category:** the tool writes the drifted files itself and returns a manifest (`updated`, `created`, `unchanged`). The agent asks the user about one category at a time.

## Special categories

- **mcp:** moves an npx entry to the global `aidemd-mcp` command (installing the package first), or with `targetVersion` moves a pinned entry's version, changing only the version text. A missing entry is returned for the agent to merge.
- **brain:** adds missing sections from the bundled template, then previews and applies one migration at a time: `brainChange` previews, `brainChange` plus `beforeHash` applies, and only if the file has not changed since the preview.
- **hooks:** keeps AIDE's Claude Code hooks in this machine's uncommitted `.claude/settings.local.json`, each running the installed server directly with node, with a 10-second budget for the session-end hook. AIDE's old entries in the shared `.claude/settings.json` are removed (every other entry stays as written), and `.claude/settings.local.json` is added to `.gitignore` when git doesn't already ignore it. A malformed settings file stops the category with nothing written, and without a global install it reports the install command instead.
- **ide:** writes the Zed config, and returns a command for the VS Code extension.
- **reference:** the tool and hook reference pages under `.aide/reference/`, its own category apart from the methodology docs. Each missing or changed page is named; one yes writes them all.

## Guarantees

- Nothing is written without the user's yes for that category, or for that one brain change.
- User code and `.aide` specs are never touched.
