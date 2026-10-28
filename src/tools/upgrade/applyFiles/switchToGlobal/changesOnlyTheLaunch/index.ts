import { isDeepStrictEqual } from "node:util";
import aidePackage from "@/service/install/shared/aidePackage/index.js";

/**
 * The last guard before a write: the edited text must parse to exactly the old
 * config with only `mcpServers[key].command` set to the global command and
 * `mcpServers[key].args` set to `[]`. Every other field of the entry (`env`,
 * `cwd`, `type`) and every other server must be unchanged. Any parse failure, or
 * any other difference, is false.
 */
export default function changesOnlyTheLaunch({
	before,
	after,
	key,
}: {
	before: string;
	after: string;
	key: string;
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
	const entry = expected?.mcpServers?.[key];
	if (typeof entry !== "object" || entry === null) return false;
	entry.command = aidePackage.command;
	entry.args = [];

	return isDeepStrictEqual(parsedAfter, expected);
}
