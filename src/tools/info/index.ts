import { z } from "zod";
import readPackageVersion from "@/util/readPackageVersion/index.js";
import buildBrainState from "@/service/buildBrainState/index.js";
import { readBrainMigrationNotice } from "@/service/install/provisionBrain/index.js";
import resolveBehind from "./resolveBehind/index.js";
import resolveOutdated from "./resolveOutdated/index.js";
import type { InfoResult } from "@/types/index.js";

export const InfoInput = z.object({});

/**
 * Passive boot-time reporter called by the orchestrator at startup.
 *
 * Returns five top-level fields (`serverVersion`, `outdated`, `behind`, `brain`,
 * `brainMigration`), each covering a distinct concern:
 *
 * - `serverVersion` + `outdated`: staleness of the host's installed AIDE
 *   artifacts against the canonical manifest shipped with this npm package.
 *   Soft notification — the pipeline can continue even when artifacts are
 *   stale. Missing `.aide/versions.json` (pre-version-tracking install)
 *   contributes no file keys. `outdated` also carries the key `hooks` when
 *   the Claude Code hooks are missing or differ from what this version
 *   installs (the same check `aide_upgrade` runs), judged even when
 *   `.aide/versions.json` is missing and silent when the check fails.
 *
 * - `behind`: staleness of the running server against the latest published
 *   version, for any launch the project's aide entry uses (global or npx).
 *   The notice names the launch kind, how many published versions behind the
 *   server is and up to three one-line highlights. Soft notice independent of
 *   `outdated`, never a gate; `null` when there is no aide entry, the version
 *   is unknown, the check is offline or fails, or the server is current.
 *
 * - `brain`: precondition state of the host's brain.
 *   Hard gate — the orchestrator must halt and direct the user to run `/aide`
 *   when `brain.status` is anything other than `"ok"`; the inline-recovery
 *   flow detects the broken state and prompts the user to resolve it.
 *
 * - `brainMigration`: soft notice naming the brain config sections whose text
 *   is a known outdated template version and any legacy brain launcher,
 *   forwarded unchanged from provisionBrain (this tool composes nothing).
 *   Never a gate and never a brain status: it does not touch `brain.status`.
 *   `null` when there is nothing to report or the project is cold.
 *
 * The concerns are structurally independent: none depends on the others,
 * and the orchestrator applies a different policy to each field.
 */
export default async function info(root: string): Promise<InfoResult> {
	// Step 1 — read the server's own package version (sync, always fast).
	const serverVersion = readPackageVersion();

	// Steps 2, 3, 4 and 5 — staleness check, behind-npm check, brain-state
	// resolution and brain-migration notice are independent; run them in
	// parallel so none blocks the others. (Each involves at least one async
	// I/O read, so parallel scheduling is a meaningful latency improvement,
	// not just cosmetic.) The notice call never rejects, so it is not wrapped.
	const [outdated, behind, brain, brainMigration] = await Promise.all([
		resolveOutdated(root),
		resolveBehind(root, serverVersion),
		buildBrainState(root),
		readBrainMigrationNotice(root),
	]);

	// Step 6 — compose the independent fields into the unified result.
	return { serverVersion, outdated, behind, brain, brainMigration };
}
