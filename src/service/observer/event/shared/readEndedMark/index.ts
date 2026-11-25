import { readFile } from "node:fs/promises";
import parseJson from "@/service/observer/event/shared/readObserverRecord/parseJson/index.js";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import { schema, type EndedMark } from "@/service/observer/event/shared/endedMark/index.js";

/**
 * Reads one ended mark. A missing, unreadable or malformed file, and an id or
 * key the resolver refuses, all answer null (no mark). Never writes.
 */
export default async function readEndedMark({
	projectKey,
	id,
}: {
	projectKey: string;
	id: string;
}): Promise<EndedMark | null> {
	let file: string;
	try {
		file = resolveEndedMark({ projectKey, id });
	} catch {
		return null;
	}

	const content = await readFile(file, "utf-8").catch(() => null);
	if (content === null) return null;

	const json = parseJson(content);
	if (json === undefined) return null;

	const parsed = schema.safeParse(json);
	return parsed.success ? parsed.data : null;
}
