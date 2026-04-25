import { getDriverById } from "@/service/brainBackends/index.js";
import type { BrainState } from "@/types/index.js";

/**
 * Prose returned when no brain backend is wired in the host's MCP config.
 *
 * Backend-agnostic — names no specific backend. Names `/aide:brain config`
 * as the single remediation entry-point per the spec's "no-mcp-entry" Good
 * example. Used for both the `no-mcp-entry` status branch and the defensive
 * contract in the `ok` branch (step 5d).
 */
const NO_MCP_ENTRY_PROSE =
	"No brain backend is wired in this project. Surface this to the user and " +
	"recommend running /aide:brain config to wire the brain. Do not proceed " +
	"with this task as if the brain were available — the user must wire it " +
	"before brain-dependent work continues.";

/**
 * Prose returned when a brain backend is configured but its vault path does
 * not resolve on disk.
 *
 * Backend-agnostic — names no specific backend. Names `/aide:brain config`
 * as the single remediation entry-point per the spec's "invalid-path" Good
 * example.
 */
const INVALID_PATH_PROSE =
	"A brain backend is configured but its vault path does not resolve on disk. " +
	"Surface this to the user and recommend running /aide:brain config to repoint " +
	"the vault at its current location. Do not proceed with this task as if the " +
	"brain were available — the path must be corrected before brain-dependent " +
	"work continues.";

/**
 * Turns a resolved `BrainState` into the agent-facing prose shape consumed by
 * `aide_brain`.
 *
 * Three branches, each satisfying a spec outcome:
 *
 * 1. `no-mcp-entry` — returns backend-agnostic remediation prose telling the
 *    agent to surface a wiring prompt. `backend` is `null`.
 * 2. `invalid-path` — returns backend-agnostic remediation prose telling the
 *    agent the vault path is broken. `backend` is `null`.
 * 3. `ok` — dispatches via `getDriverById(state.backend)` to retrieve the
 *    registered driver and calls its `renderInstructions({ vaultPath })` to
 *    produce ready-to-execute entry-point reach prose. `backend` carries the
 *    resolved driver id.
 *
 * Load-bearing invariant: `instructions` is **never empty** regardless of
 * which branch fires. A response with `status: "ok"` and empty `instructions`
 * is a forbidden state per the spec's "Silent success forbidden" undesired
 * outcome — the defensive clause in the `ok` branch (step 5d) enforces this
 * even when `buildBrainState` violates its own contract.
 */
export default function composeInstructions(state: BrainState): {
	backend: string | null;
	instructions: string;
} {
	// spec outcome: "no-mcp-entry" → remediation prose, agent stops
	if (state.status === "no-mcp-entry") {
		return { backend: null, instructions: NO_MCP_ENTRY_PROSE };
	}

	// spec outcome: "invalid-path" → remediation prose, agent stops
	if (state.status === "invalid-path") {
		return { backend: null, instructions: INVALID_PATH_PROSE };
	}

	// spec outcome: "ok" → dispatch to registry driver, return reach prose

	// Defensive contract (step 5d): `buildBrainState` guarantees that
	// `status === "ok"` implies both `vaultPath: string` and `backend: string`.
	// If either is null here, the upstream contract was violated. Rather than
	// silently returning empty instructions (forbidden by the spec's
	// "instructions never empty" invariant), we treat the impossible state
	// as `invalid-path` and surface remediation prose. This defends the
	// invariant without masking the upstream bug — the null values are
	// themselves the signal that something went wrong above.
	if (state.vaultPath === null || state.backend === null) {
		return { backend: null, instructions: INVALID_PATH_PROSE };
	}

	const driver = getDriverById(state.backend);

	// Defensive contract (step 5d, extended): if the registry no longer
	// contains a driver for the id that `buildBrainState` resolved (e.g. the
	// driver was removed from the registry after state was built), this is
	// also an upstream contract violation. Treat identically to the null
	// vaultPath/backend case — return the `INVALID_PATH_PROSE` shape with
	// `backend: null` so `instructions` is never empty.
	if (driver === null) {
		return { backend: null, instructions: INVALID_PATH_PROSE };
	}

	// spec outcome: "ok" with resolved driver → ready-to-execute reach prose
	const instructions = driver.renderInstructions({ vaultPath: state.vaultPath });
	return { backend: state.backend, instructions };
}
