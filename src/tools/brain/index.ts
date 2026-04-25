import { z } from "zod";
import buildBrainState from "@/service/buildBrainState/index.js";
import composeInstructions from "./composeInstructions/index.js";
import type { BrainToolResult } from "@/types/index.js";

/**
 * Input schema for `aide_brain`. No parameters — the tool always uses the
 * server's working directory, mirroring `aide_info`'s pattern.
 */
export const BrainInput = z.object({});

/**
 * Runtime brain entry-point tool.
 *
 * Called **on demand** — when an agent needs to reach the brain mid-task. It
 * must NOT be called from `aide_info`, and must NOT be fired automatically on
 * `/aide` boot. Boot-time brain state is already surfaced by `aide_info.brain`;
 * firing this tool unconditionally at boot would duplicate that work and violate
 * the spec's undesired outcome: "aide_brain called on every /aide boot instead
 * of on demand."
 *
 * Pipeline (linear — the single async hop is `buildBrainState`; composition is
 * pure, so `Promise.all` would be ceremonial):
 *
 * 1. `buildBrainState(root)` — detection and registry dispatch; never throws.
 * 2. `composeInstructions(state)` — pure formatter; produces `{ backend, instructions }`.
 * 3. Return `{ status, backend, instructions }`.
 *
 * Response contract:
 * - `status` mirrors `aide_info.brain.status` exactly (`"ok"`, `"no-mcp-entry"`,
 *   `"invalid-path"`). An agent that already saw boot-time brain state does not
 *   learn new vocabulary from this tool.
 * - `backend` is the structured discriminant: the resolved driver id (e.g.
 *   `"obsidian"`) on `"ok"`, `null` on all other branches.
 * - `instructions` is always non-empty — server-assembled prose. On `"ok"`, it
 *   tells the agent which MCP tools to call and how to reach the wired backend's
 *   seeded entry-point file. On non-ok branches, it carries remediation prose.
 *
 * The orchestrator encodes no backend knowledge. Every per-backend decision is
 * delegated to the registry via `composeInstructions`.
 */
export default async function brain(root: string): Promise<BrainToolResult> {
	// Step 1 — resolve brain precondition state via detection and registry dispatch.
	const state = await buildBrainState(root);

	// Step 2 — compose agent-facing prose from the resolved state.
	const { backend, instructions } = composeInstructions(state);

	// Step 3 — return the unified tool result.
	return { status: state.status, backend, instructions };
}
