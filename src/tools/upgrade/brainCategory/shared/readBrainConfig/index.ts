import { readFile } from "node:fs/promises";
import { join } from "node:path";
import parseBrainAide, { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import type { ParseBrainAideResult } from "@/types/index.js";

/**
 * Reads `.aide/config/brain.aide` once and returns both the raw bytes and their parse, so
 * a caller that splices text works from exactly the bytes it parsed.
 *
 * On any read error `raw` is `null` and `parse` comes from `parseBrainAide(projectRoot)`,
 * which owns the `missing` / `unreadable` wording; this helper never restates those labels.
 */
export default async function readBrainConfig(
	projectRoot: string,
): Promise<{ raw: string | null; parse: ParseBrainAideResult }> {
	const brainAidePath = join(projectRoot, ".aide", "config", "brain.aide");

	let raw: string;
	try {
		raw = await readFile(brainAidePath, "utf-8");
	} catch {
		// Any read error: the parser classifies it (ENOENT -> missing, anything else -> unreadable).
		return { raw: null, parse: await parseBrainAide(projectRoot) };
	}

	return { raw, parse: parseBrainAideFromString(raw) };
}
