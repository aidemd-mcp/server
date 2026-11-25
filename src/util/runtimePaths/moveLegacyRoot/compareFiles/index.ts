import { readFile } from "node:fs/promises";

/**
 * Compare a legacy `source` file with its `target` byte for byte. `missing`: the target does
 * not exist. `same`: equal. `target-behind`: the target is a strict byte prefix of the source
 * (the log grew after an earlier copy). `target-ahead`: the source is a strict byte prefix of
 * the target. `diverged`: anything else. A missing source, or any read error other than a
 * missing target, throws.
 */
export default async function compareFiles({
	source,
	target,
}: {
	source: string;
	target: string;
}): Promise<"missing" | "same" | "target-behind" | "target-ahead" | "diverged"> {
	const sourceBytes = await readFile(source);
	const targetBytes = await readFile(target).catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return null;
		throw error;
	});
	if (targetBytes === null) return "missing";

	if (sourceBytes.equals(targetBytes)) return "same";
	if (targetBytes.length < sourceBytes.length && sourceBytes.subarray(0, targetBytes.length).equals(targetBytes)) {
		return "target-behind";
	}
	if (sourceBytes.length < targetBytes.length && targetBytes.subarray(0, sourceBytes.length).equals(sourceBytes)) {
		return "target-ahead";
	}
	return "diverged";
}
