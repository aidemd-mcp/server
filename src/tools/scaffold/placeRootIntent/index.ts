import { rename } from "node:fs/promises";
import { join } from "node:path";
import writeIfAbsent from "../writeIfAbsent/index.js";

/**
 * Places the project root intent spec in the project's `.aide` folder. The root
 * spec always takes the explicit name `intent.aide` because its folder holds
 * many other AIDE files, so a bare `.aide` there would be ambiguous; an older
 * project's bare `.aide/.aide` is promoted in place, content kept. An existing
 * `intent.aide` is never touched (even with a bare `.aide` beside it), and a
 * fresh spec is created through the exclusive-create write so nothing is ever
 * overwritten. Research presence is deliberately not consulted. Never deletes.
 *
 * `folder` is the `.aide` folder (already created by the caller), `existing`
 * the file names in it ending `.aide`, `template` the intent template text.
 */
export default async function placeRootIntent({
	folder,
	existing,
	template,
}: {
	folder: string;
	existing: string[];
	template: string;
}): Promise<"created" | "renamed" | "exists"> {
	if (existing.includes("intent.aide")) return "exists";

	if (existing.includes(".aide")) {
		await rename(join(folder, ".aide"), join(folder, "intent.aide"));
		return "renamed";
	}

	return writeIfAbsent(join(folder, "intent.aide"), template);
}
