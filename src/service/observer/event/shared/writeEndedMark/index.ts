import { writeFile } from "node:fs/promises";
import resolveEndedMark from "@/util/runtimePaths/resolveEndedMark/index.js";
import { parse, type EndedMark } from "@/service/observer/event/shared/endedMark/index.js";

/**
 * Writes one ended mark with an exclusive create, so a mark is written once
 * and an existing one is left exactly as it is (brief commitments #72, #95).
 * Creates no folder: callers ran `create` first. Throws when the mark does not
 * fit the schema; resolves `"exists"` on EEXIST; every other write error
 * propagates, since callers decide what a failed write means.
 */
export default async function writeEndedMark({
	projectKey,
	mark,
}: {
	projectKey: string;
	mark: EndedMark;
}): Promise<"written" | "exists"> {
	const valid = parse(mark);
	if (valid === null) throw new Error("ended mark does not fit the schema");
	const id = (valid.sessionId ?? valid.claudeSessionId) as string;
	const file = resolveEndedMark({ projectKey, id });

	try {
		await writeFile(file, JSON.stringify(valid) + "\n", { encoding: "utf-8", flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
		throw error;
	}
	return "written";
}
