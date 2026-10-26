import { isDeepStrictEqual } from "node:util";

/**
 * The last guard before a write: the edited text must parse to exactly the old
 * config with only the pin (`mcpServers.aide.args[specIndex]`) changed to `spec`.
 * Any parse failure, or any other difference, is false.
 */
export default function changesOnlyThePin({
	before,
	after,
	specIndex,
	spec,
}: {
	before: string;
	after: string;
	specIndex: number;
	spec: string;
}): boolean {
	let parsedBefore: any;
	let parsedAfter: unknown;
	try {
		parsedBefore = JSON.parse(before);
		parsedAfter = JSON.parse(after);
	} catch {
		return false;
	}

	const expected = structuredClone(parsedBefore);
	const args = expected?.mcpServers?.aide?.args;
	if (!Array.isArray(args)) return false;
	args[specIndex] = spec;

	return isDeepStrictEqual(parsedAfter, expected);
}
