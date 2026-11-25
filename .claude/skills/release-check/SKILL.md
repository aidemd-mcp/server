---
name: release-check
description: >
  Pre-release end-to-end test for this repo (@aidemd-mcp/server) only. Packs
  the build exactly as it would publish, installs it into a throwaway project
  under a temp npm prefix, and checks `aidemd-mcp init`, the hooks merge, the
  hook command, the observer (port list, HALT, end-session, page) and headless
  `/aide` sessions — isolated from the real global install, the real observer
  and the real per-user app data. Run it before every publish, when the user
  asks to test a change before release, or when they type /release-check. Not
  shipped and not installed into host projects.
---

# release-check — test the package before it ships

The harness is `run.mjs` beside this file. What it relies on, and why, is in `NOTES.md`; read it when a check fails or the environment looks different.

## Run it

1. Make sure the working tree holds what the release would ship (built from the current source; `npm run build` is part of the run).
2. Run, in the background (it takes ~2 minutes, longer with the headless sessions):

   ```
   node .claude/skills/release-check/run.mjs --keep
   ```

   Flags: `--keep` keeps the temp folder for inspection (always print its path to the user); `--skip-build` reuses `dist/`; `--no-claude` skips the headless `claude -p` sessions.
3. Read the PASS / FAIL / SKIP table it prints and `report.json` in the temp folder. Exit code 0 means every check that ran passed.

## What it checks

- **Pack and install:** the `.tgz` `npm pack` produces, installed into a temp npm prefix that every test process sees first on PATH; the CLI and `aide_info` report the packed version; the MCP handshake reports it too.
- **Fresh project:** `aidemd-mcp init` writes the `aide` and `brain` MCP entries, AIDE's five hook entries in `.claude/settings.json` and the `aide-observer` skill, installs nothing globally, and a second run changes no file. The brain is wired to a temp vault the same way `/aide:brain config` does it.
- **Existing settings:** an existing `.claude/settings.json` (comments, a user hook, another key) is left byte-identical with the `/aide:upgrade` follow-up; a malformed one gets `[skipped-malformed]`.
- **Hook:** `aidemd-mcp hook` for each hook event exits 0, prints nothing, moves presence working → linked → waiting → ended, and writes nothing into the project.
- **Observer, simulated agent (no login needed):** drives the packed server over MCP stdio — start binds a port other than the real observer's, the session links, a fake open Claude session causes a HALT naming it, `aide_observer_end_session` ends it (and refuses the caller's own session), the next start passes; the page and JSON API answer with liveness states and refuse a missing token.
- **Headless `/aide` sessions:** real `claude -p` runs in the test project, loading only its own MCP servers and settings: one plain boot, then a HALT against an open session, then an approved end. These need a signed-in Claude CLI; when it is not signed in they SKIP — say so plainly, never as a pass.
- **One-time move (Windows):** a packed server with a fake home and a fake `%LOCALAPPDATA%` moves seeded history from the old `%LOCALAPPDATA%\aidemd` into `%USERPROFILE%\.aidemd` byte for byte, deletes the old observer record and token, and changes nothing on a second start.
- **Your setup untouched:** the real global install, the real observer's record and port, and both real per-user folders (`AIDEMD_HOME` or `%USERPROFILE%\.aidemd`, and the old `%LOCALAPPDATA%\aidemd`) are snapshotted before and after and must match. If port 24680 is listening but no observer record can be read, the check fails rather than passing blind.

## Rules

- Never run it against, or let it modify, the real global npm install, the real observer, the real per-user app data or the user's brain vault. If a check would need that, stop and tell the user.
- A FAIL is reported to the user with its evidence and fixed through the normal path (code through `/aide`, prose directly). Never patch the harness to make a product defect pass.
- When a check proves wrong or the environment changes, fix `run.mjs` and record what you learned in `NOTES.md`.
- When a release adds or changes user-facing behaviour, add a check for it here in the same piece of work.
- A release ships only when every check that ran passes. Headless SKIPs must be named in the release report; run them from a signed-in terminal before publishing when the change touches the boot, the skills or the hooks.
