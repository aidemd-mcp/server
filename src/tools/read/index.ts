import { z } from "zod";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname, basename, isAbsolute, relative } from "node:path";
import type { AideFile, ReadResult } from "@/types/index.js";
import { classifyFile } from "@/util/classify/index.js";

export const ReadInput = z.object({
	path: z.string().describe("Path to the .aide file to read"),
});

/** Extract links from .aide content: [[wikilinks]], relative paths, URLs. */
function extractLinks(content: string): string[] {
	const links: string[] = [];
	const seen = new Set<string>();

	const add = (link: string) => {
		if (!seen.has(link)) {
			seen.add(link);
			links.push(link);
		}
	};

	// [[wikilinks]]
	for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) add(`[[${match[1]}]]`);

	// Relative paths: ./something or ../something
	for (const match of content.matchAll(/(?:^|\s)(\.\.?\/[^\s),\]]+)/gm)) add(match[1]);

	// URLs
	for (const match of content.matchAll(/https?:\/\/[^\s),\]>]+/g)) add(match[0]);

	return links;
}

/** Find sibling .aide files in the same directory. */
async function findSiblings(filePath: string, root: string): Promise<AideFile[]> {
	const dir = dirname(filePath);
	const currentName = basename(filePath);
	const siblings: AideFile[] = [];

	try {
		const entries = await readdir(dir);
		for (const name of entries) {
			if (name === currentName) continue;
			if (!name.endsWith(".aide")) continue;

			const sibPath = join(dir, name);
			const relativePath = relative(root, sibPath).split("\\").join("/");

			siblings.push({
				path: sibPath,
				relativePath,
				type: classifyFile(name),
				summary: "",
			});
		}
	} catch {
		// skip unreadable dirs
	}

	return siblings;
}

/**
 * Read an .aide file with context awareness.
 * Returns the file content, classified type, sibling specs in the same
 * directory, and links found in the content.
 */
export default async function read(root: string, filePath: string): Promise<ReadResult> {
	const resolved = isAbsolute(filePath) ? filePath : join(root, filePath);

	let content: string;
	try {
		content = await readFile(resolved, "utf-8");
	} catch {
		return {
			content: `Path not found: ${filePath}`,
			type: "intent",
			siblings: [],
			links: [],
		};
	}

	const type = classifyFile(basename(resolved));
	const siblings = await findSiblings(resolved, root);
	const links = extractLinks(content);

	return { content, type, siblings, links };
}
