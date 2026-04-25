import type { BackendDriver, McpServerEntry } from "@/types/index.js";

export type { BackendDriver, McpServerEntry };

/**
 * Returns true when the entry matches the Obsidian MCP launcher shape that
 * `provisionBrain.obsidianMcpEntry` writes.
 *
 * Two platform shapes are recognised:
 *   - POSIX: `command === "npx"`, `args[0] === "@bitbonsai/mcpvault"`, at least
 *     two args (package + vault path).
 *   - Windows: `command === "cmd"`, `args[0] === "/c"`, `args[1] === "npx"`,
 *     `args[2] === "@bitbonsai/mcpvault"`, at least four args (cmd flag, npx,
 *     package, vault path).
 *
 * Defensive shape checks (`Array.isArray`, `typeof command === "string"`, and
 * position-by-position string comparisons) are all contained here so neither
 * caller needs to revalidate the shape before passing the entry in.
 * Pure synchronous — no I/O, no async, no side effects.
 */
function matchesObsidian(entry: McpServerEntry): boolean {
	if (typeof entry.command !== "string" || !Array.isArray(entry.args)) {
		return false;
	}

	// POSIX shape: npx @bitbonsai/mcpvault <vaultPath>
	if (
		entry.command === "npx" &&
		entry.args.length >= 2 &&
		entry.args[0] === "@bitbonsai/mcpvault"
	) {
		return true;
	}

	// Windows shape: cmd /c npx @bitbonsai/mcpvault <vaultPath>
	if (
		entry.command === "cmd" &&
		entry.args.length >= 4 &&
		entry.args[0] === "/c" &&
		entry.args[1] === "npx" &&
		entry.args[2] === "@bitbonsai/mcpvault"
	) {
		return true;
	}

	return false;
}

/**
 * The obsidian driver's `renderInstructions` function.
 *
 * Returns ready-to-execute prose that names the MCP read tool
 * (`mcp__brain__read_note`) and the seeded entry-point file path, says in one
 * sentence what that file contains, then closes with a handoff sentence
 * indicating the brain takes over from there.
 *
 * The prose never enumerates the content of the seeded `CLAUDE.md` — no
 * folder structure, no wikilink protocol, no where-to-find-things table, no
 * decision protocol, no write rules — per the spec's undesired-outcome line
 * that forbids duplicating what the seeded entry-point file owns.
 *
 * The `vaultPath` is interpolated as-is with no normalization or
 * trailing-slash trimming. The returned string is always non-empty.
 */
const OBSIDIAN_INSTRUCTION_TEMPLATE = (state: { vaultPath: string }): string =>
	`Use \`mcp__brain__read_note\` to read the file at \`${state.vaultPath}/CLAUDE.md\`. ` +
	`That file contains the navigation rules for this brain vault. ` +
	`The brain takes over from here and this server has no further role in your navigation.`;

/**
 * The single registered driver for the Obsidian backend.
 *
 * Both accessors (`resolveBackend` and `getDriverById`) return this same
 * object reference — reference identity is the structural guarantee that the
 * two accessors cannot drift, and step 7b's symmetry test asserts `===`
 * equality between them.
 */
const OBSIDIAN_DRIVER: BackendDriver = {
	id: "obsidian",
	renderInstructions: OBSIDIAN_INSTRUCTION_TEMPLATE,
};

/**
 * The single source both accessors walk.
 *
 * Adding a backend = appending one entry `{ matcher, driver }` to this array.
 * Order matters only if two predicates could ever fire on the same entry shape,
 * which today they cannot — there is exactly one entry.
 */
// reference identity matters here — both accessors must return the same
// driver object for the same backend, never a clone or rebuild.
const MATCHERS: ReadonlyArray<{
	matcher: (entry: McpServerEntry) => boolean;
	driver: BackendDriver;
}> = [{ matcher: matchesObsidian, driver: OBSIDIAN_DRIVER }] as const;

/**
 * Resolves the backend driver for the given MCP server entry.
 *
 * Walks the MATCHERS table and returns the driver for the first entry whose
 * matcher predicate fires on `entry`. Returns `null` for every unrecognized
 * wiring — the contract is structured (driver-or-null), not exception-based.
 * Per the spec's `outcomes.undesired`, this function never throws, never falls
 * back to a default backend, and never dispatches on the MCP server key name.
 * Recognition is always determined by the entry's command/args shape.
 */
export default function resolveBackend(
	entry: McpServerEntry,
): BackendDriver | null {
	for (const { matcher, driver } of MATCHERS)
		if (matcher(entry)) return driver;
	return null;
}

/**
 * Returns the driver whose `id` property matches the given string, or `null`
 * if no registered backend claims that id.
 *
 * Walks the same `MATCHERS` array that `resolveBackend` walks — never a
 * parallel `Map` or separate registration list. This symmetry is the structural
 * guarantee that both accessors can never diverge: one entry point for
 * registration, two read-only views over it. Per the spec's `outcomes.undesired`,
 * accessor inconsistency (one accessor returning a driver the other would not)
 * is forbidden; sharing the walk over `MATCHERS` makes the inconsistency
 * impossible by construction.
 *
 * Comparison is case-sensitive and literal — `"obsidian"` matches, `"OBSIDIAN"`
 * does not. Returns `null` for every unrecognised id; never throws.
 */
export function getDriverById(id: string): BackendDriver | null {
	for (const { driver } of MATCHERS)
		if (driver.id === id) return driver;
	return null;
}
