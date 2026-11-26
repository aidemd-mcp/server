# release-check: notes

What the harness (`run.mjs`) relies on, and what it took to find out.

## Isolation

- **Per-user runtime files.** The product picks its per-user root in this order:
  1. `AIDEMD_HOME`, when it is set, non-empty and absolute. This works on every OS, and the value is the root itself.
  2. Otherwise, on Windows, `<os.homedir()>\.aidemd`.
  3. Otherwise the per-OS default: `~/Library/Application Support/aidemd` on macOS, and `$XDG_STATE_HOME/aidemd` or `~/.local/state/aidemd` on Linux.

  Windows no longer reads `%LOCALAPPDATA%`. The Claude desktop app is an MSIX package, and MSIX quietly redirects `%LOCALAPPDATA%` writes into `Packages\Claude_<id>\LocalCache\Local`. Desktop-app sessions and terminal sessions therefore ended up with separate roots.

  The harness sets `AIDEMD_HOME=<tmp>\aidemd-home` for every AIDE process it starts: the CLI, the MCP server, hooks and `claude -p`. It overrides nothing else. This also isolates macOS, which the old variables could not. The MCP server passes its env on to the detached observer it spawns, and the hook resolves the same root. The product never runs its legacy-root move while `AIDEMD_HOME` is set, so the main checks cannot touch a real `%LOCALAPPDATA%\aidemd`.
- **npm global prefix.** `aidemd-mcp init` runs `npm root -g` (`checkGlobalPackage`) and, if the package is missing there, runs `npm i -g @aidemd-mcp/server` from the registry. To keep that away from the real global install, every AIDE process gets `npm_config_prefix=<tmp>/prefix`. `npm root -g` then points at the temp prefix, which already has the packed build, so init installs nothing. Check 3.init asserts that no "Installing … globally" line appears.
- **npm install itself** runs with the normal env and only `--prefix`. npm's cache lives under `%LOCALAPPDATA%\npm-cache`, and overriding it would download every dependency again.
- **Windows prefix layout.** `npm i -g --prefix P` puts the shims in `P` itself, not `P\bin`, and the package in `P\node_modules\@aidemd-mcp\server`.
- **The parent session's env leaks in.** When the harness runs inside Claude Code, `CLAUDE_PROJECT_DIR` (and `CLAUDECODE` etc.) are already set. The hook gives `CLAUDE_PROJECT_DIR` priority over the input's `cwd`, so a leaked value would file presence under this repo's key. The harness strips these, plus any `AIDEMD_HOME` from the shell, from the base env. It sets `CLAUDE_PROJECT_DIR` to the test project only for hook calls.
- **The real observer's port is whatever its record says.** It is not always 24680: the port list falls through to 24681 and on when 24680 is taken, and on 2026-11-26 the real observer was on 24681 while 24680 was free, so the test observer correctly took 24680 and a check that assumed "24680 = real" failed. The harness reads the port from the real record (`realPort`), falls back to 24680 only when no record is readable, and treats a port as the real observer's only while that port is actually listening.
- **Observer port.** With the real observer on 24680, the isolated observer finds no record in the temp AIDE root, walks the port list and binds 24681. `takeOver` finds observers only through the root's record, so it can never ask the real one to shut down. At the end the harness stops the observer by the pid in the temp `observer.json`. It refuses if that pid or port matches the real observer.
- **Headless sign-in.** The desktop app's terminal panel and the agent's own shell both report "this login reached its time limit" for `claude -p`. Run the headless checks from a standalone terminal after `claude auth login` (or with `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`).

## Real roots (check 9.real)

- **`REAL_AIDE_ROOT`** is the shell's `AIDEMD_HOME` when it is absolute, else `%USERPROFILE%\.aidemd` on Windows, else the per-OS default. On Windows the harness also watches **`REAL_LEGACY_ROOT`**, which is `%LOCALAPPDATA%\aidemd` as this shell sees it.
- **Before and after the run**, the harness records:
  - `npm ls -g`;
  - the pid listening on 24680, from `netstat`;
  - for each real root, its `observer.json` (mtime, hash, pid) and any `rc-project-*` folders.

  The real observer is judged by the new root's record, or by the legacy root's when the new root has none. The baseline records which one it used.
- **9.real asserts** that:
  - `npm ls -g` and the 24680 listener pid are unchanged;
  - both roots' `observer.json` files are unchanged;
  - neither root holds a folder with the test project's key.

  Other projects' presence files change all the time from live sessions, so the check looks only for the test key.
- **It never passes blind.** On 2026-11-25 a run from the Claude desktop app's terminal panel printed `observer pid none` while the real observer was listening on 24680. That observer had been started inside the app, so the MSIX redirect kept its record in the app's private AppData, where a standalone shell cannot read it. 9.real now FAILS whenever 24680 is listening (before or after the run) and neither root has a readable record. The message names both paths and the likely cause: an observer started inside the desktop app by a version from before `AIDEMD_HOME` keeps its record in the app's private AppData. The fix is to run the check from inside the app, or to restart that observer after upgrading.

## Legacy-root move (10.move, Windows only)

- **What the product does.** On Windows, `aide_observer_start` first runs a one-time move from the old `%LOCALAPPDATA%\aidemd`, as that process sees it, into the new root. It moves logs, the archive, presence files and ended marks, and verifies each copy byte for byte before deleting the original. It deletes the old `observer.json` and `observer-token`. The move never runs while `AIDEMD_HOME` is set.
- **How the check sets up.** It starts one packed MCP server with `AIDEMD_HOME` removed from its env, `USERPROFILE=<tmp>\home` (with `HOMEDRIVE` and `HOMEPATH` to match) and `LOCALAPPDATA=<tmp>\la`.
  - On Windows, `os.homedir()` reads `USERPROFILE`. Before starting the server, the check runs node with the same env to confirm that.
  - It refuses to run if either fake root resolves to a real root.
- **What it seeds** under `<tmp>\la\aidemd`: a session log, its ended mark, a linked presence in the ended state, `observer.json` and `observer-token`. The seeded session is ended so it cannot cause a HALT.
- **What it asserts.** After it reports `session_started` and calls `aide_observer_start`:
  - each seeded file exists byte-identical under `<tmp>\home\.aidemd`;
  - the old copies are gone;
  - the old record and token are deleted.

  A second start must leave every file hash in the new root unchanged.
- **Cleanup.** It stops the observer it started, by the pid in `<tmp>\home\.aidemd\observer.json`, unless that pid or port matches the real observer.
- **Other OSes.** The check is SKIP there, because the legacy root exists only on Windows.

- **Reaching outside the desktop app from its shell.** Every process the Claude desktop app starts runs inside its MSIX package, so its `%LOCALAPPDATA%` reads and writes go to the package's private copy. To see what a standalone terminal sees, launch a script through `explorer.exe` (`cmd /c start "" explorer.exe <script.cmd>`) and have it write its result to a non-AppData path (e.g. under the repo). Verified 2026-11-25: such a script saw no observer record under the real `%LOCALAPPDATA%`, and read a file the app had written to `%USERPROFILE%`, confirming the profile folder is not redirected.

## CLI facts

- `aidemd-mcp --help` is not a command. Any unknown first argument starts the MCP stdio server, which then waits on stdin. Use `aidemd-mcp sync --help` instead: it prints `Usage:` and exits 2 by design.
- `init` always prints the SETUP INCOMPLETE block, because brain wiring and IDE are always deferred. So "idempotent" is checked with a file-hash snapshot before and after the second run, not from the output.
- Brain wiring without an agent: in `.aide/config/brain.aide`, replace the bare `-` (YAML null) last entry under `mcpServerConfig.args` with the vault path, then run `aidemd-mcp sync`. After that, `aide_info` reports `brain.status: ok`. The board needs the `kanban:` field's `  path:` filled too (the vault joined with `kanban`); the harness does that and seeds one task at `<vault>/kanban/release-check/backlog/release-check-task.md`. Sessions report no brain folder, and 8.page asserts `/api/projects/<key>/status` shows the board available with that task.
- The hook needs only `session_id`, `hook_event_name` and `cwd` (or `CLAUDE_PROJECT_DIR`). A PostToolUse for any tool whose name ends in `__aide_observer_event` links the presence when `tool_response` contains `[observer-session <id>]`, whatever its shape. Each hook call takes about 300–400 ms through the `.cmd` shim.

## Simulated vs headless agent

- Checks 6s/7s/8 drive the packed server over MCP stdio (newline-delimited JSON-RPC) and make the same hook calls Claude Code would make. They are deterministic and need no login, so they always run. The MCP server is launched as `node <prefix>/node_modules/@aidemd-mcp/server/dist/index.js`, which is the same entry the shim runs. The shim itself is checked in 2.resolve. Launching through the shim would leave a `cmd.exe` wrapper that is harder to stop.
- Checks 6h/7h run real `claude -p` sessions with `--strict-mcp-config --mcp-config <project>/.mcp.json --setting-sources project,local`. That means only the test project's MCP servers load (never a user-scope `brain` pointing at the real vault), and none of the user's own hooks or plugins run. The prompt goes in on stdin to avoid `cmd.exe` quoting.
- **Validated 2026-11-25:** `claude -p` runs fine with `AIDEMD_HOME` set, and 6h/7h passed end to end: run1 about 55 s, the HALT run about 28 s, the approve run about 29 s, roughly 3.7 minutes for the whole check. When the CLI is not signed in, the preflight turns that into SKIP. The preflight (6h.preflight) only checks that `claude -p` runs with `AIDEMD_HOME` set. Claude Code does not read that variable, so the old fallback for a `LOCALAPPDATA` override that broke Claude Code is gone.

## Known product findings

- None open. The MCP `serverInfo` version that was hard-coded as `"0.2.0"` is fixed; 2.serverInfo passes.
