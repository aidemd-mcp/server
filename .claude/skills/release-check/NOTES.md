# release-check: notes

What the harness (`run.mjs`) relies on, and what it took to find out.

## Isolation

- **Per-user runtime files.** `resolveAppDataRoot` uses `%LOCALAPPDATA%\aidemd` on Windows when the value is set and absolute, else `$XDG_STATE_HOME/aidemd` on Linux. macOS ignores both (it is always `~/Library/Application Support/aidemd`), so the harness only isolates on Windows and Linux. Setting both variables in the env of every child process (CLI, MCP server, hooks, `claude -p`) is enough: the MCP server passes the env on to the detached observer it spawns, and the hook resolves the same root.
- **npm global prefix.** `aidemd-mcp init` runs `npm root -g` (`checkGlobalPackage`) and, if the package is missing there, runs `npm i -g @aidemd-mcp/server` from the registry. To keep that away from the real global install, every AIDE process gets `npm_config_prefix=<tmp>/prefix`. `npm root -g` then points at the temp prefix, which already has the packed build, so init installs nothing. Check 3.init asserts that no "Installing … globally" line appears.
- **npm install itself** runs with the normal env and only `--prefix`. npm's cache lives under `%LOCALAPPDATA%\npm-cache`, and overriding it would download every dependency again.
- **Windows prefix layout.** `npm i -g --prefix P` puts the shims in `P` itself, not `P\bin`, and the package in `P\node_modules\@aidemd-mcp\server`.
- **The parent session's env leaks in.** When the harness runs inside Claude Code, `CLAUDE_PROJECT_DIR` (and `CLAUDECODE` etc.) are already set. The hook gives `CLAUDE_PROJECT_DIR` priority over the input's `cwd`, so a leaked value would file presence under this repo's key. The harness strips these from the base env and sets `CLAUDE_PROJECT_DIR` to the test project only for hook calls.
- **Observer port.** With the real observer on 24680, the isolated observer reads no record in the temp app data, walks the port list and binds 24681. `takeOver` only finds observers through the app-data record, so it can never ask the real one to shut down. At the end the harness stops the observer by the pid in the temp `observer.json`. It refuses if that pid or port matches the real observer.
- **Real-setup evidence.** Before and after the run, the harness reads `npm ls -g`, the real `observer.json` (mtime, hash, pid), the 24680 LISTENING pid from `netstat`, and checks the real app-data root for `rc-project-*` folders. Other projects' presence files in the real app data change all the time (live sessions), so the check looks only for the test project's key.

## CLI facts

- `aidemd-mcp --help` is not a command. Any unknown first argument starts the MCP stdio server, which then waits on stdin. Use `aidemd-mcp sync --help` instead: it prints `Usage:` and exits 2 by design.
- `init` always prints the SETUP INCOMPLETE block, because brain wiring and IDE are always deferred. So "idempotent" is checked with a file-hash snapshot before and after the second run, not from the output.
- Brain wiring without an agent: in `.aide/config/brain.aide`, replace the bare `-` (YAML null) last entry under `mcpServerConfig.args` with the vault path, then run `aidemd-mcp sync`. After that, `aide_info` reports `brain.status: ok`.
- The hook needs only `session_id`, `hook_event_name` and `cwd` (or `CLAUDE_PROJECT_DIR`). A PostToolUse for any tool whose name ends in `__aide_observer_event` links the presence when `tool_response` contains `[observer-session <id>]`, whatever its shape. Each hook call takes about 300–400 ms through the `.cmd` shim.

## Simulated vs headless agent

- Checks 6s/7s/8 drive the packed server over MCP stdio (newline-delimited JSON-RPC) and make the same hook calls Claude Code would make. They are deterministic and need no login, so they always run. The MCP server is launched as `node <prefix>/node_modules/@aidemd-mcp/server/dist/index.js`, which is the same entry the shim runs. The shim itself is checked in 2.resolve. Launching through the shim would leave a `cmd.exe` wrapper that is harder to stop.
- Checks 6h/7h run real `claude -p` sessions with `--strict-mcp-config --mcp-config <project>/.mcp.json --setting-sources project,local`. That means only the test project's MCP servers load (never a user-scope `brain` pointing at the real vault), and none of the user's own hooks or plugins run. The prompt goes in on stdin to avoid `cmd.exe` quoting.
- **Not yet validated:** on the first run (2026-11-25), `claude auth status` reported `loggedIn: false` in the environment the harness ran in. That environment was a Claude Code subagent shell with `ANTHROPIC_BASE_URL` set by the host. Every `claude -p` call failed with "this login reached its time limit", with and without the `LOCALAPPDATA` override. The preflight turns that into SKIP. As a result, two things are still unknown: whether Claude Code works with `LOCALAPPDATA` overridden, and whether the stream-json parsing in 6h/7h is right. If the override turns out to break Claude Code, the preflight says so (it retries without the override). The fallback is an `env` block on the `aide` entry in the test project's `.mcp.json`, plus an env prefix on the hook command in its `.claude/settings.json`.

## Known product findings

- `src/startServer/index.ts` hard-codes the MCP `serverInfo` version as `"0.2.0"`. `aide_info` reports the real package version. Check 2.serverInfo fails until that is fixed.
