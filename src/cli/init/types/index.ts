/**
 * Status of a single artifact install attempt.
 *
 * - `"created"` — `applySteps` wrote a `would-create` step to disk.
 * - `"exists"` — planner returned `exists` (file bytes match canonical) OR
 *   `writeMcpEntry` returned `exists`. File is already at canonical state;
 *   no write happened. Does NOT surface in the warning.
 * - `"skipped-drift"` — planner returned `would-overwrite` (file exists with
 *   bytes drifted from canonical). The CLI never overwrites, so the step is
 *   not sent to `applySteps`. Surfaces in the warning's skipped list.
 * - `"skipped-missing-canonical"` — planner returned `would-skip` (canonical
 *   read failed). Surfaces in the warning's skipped list with the reason string.
 * - `"failed"` — reserved; not produced on the planner path. Kept because
 *   `renderWarning` and the orchestrator already branch on it — removing it
 *   widens the diff unnecessarily.
 */
export type InstallStatus =
    | "created"
    | "exists"
    | "skipped-drift"
    | "skipped-missing-canonical"
    | "failed";

/**
 * Result of installing a single artifact.
 *
 * `displayPath` is the host-relative path used as both the per-file log prefix
 * (e.g. `[created] .claude/agents/aide/aide-architect.md — pipeline agent`) and
 * the warning list entry for skipped or failed artifacts. It always uses forward
 * slashes regardless of platform so that log output and test assertions are stable.
 *
 * `message` is the short reason printed after the `—` separator:
 * - For `created`: a short label, e.g. `"pipeline agent"` or `"canonical aide-spec doc"`.
 * - For `exists`: a reason like `"already present"`.
 * - For `skipped-drift`: a reason like `"drifted from canonical — not overwritten"`.
 * - For `skipped-missing-canonical`: the reason string from the failed canonical read.
 * - For `failed`: the error message from the caught exception.
 */
export type InstallResult = {
    status: InstallStatus;
    displayPath: string;
    message: string;
};
