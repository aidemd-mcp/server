import { z } from "zod";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { InspectResult, InspectHit } from "@/types/index.js";
import walk from "./walk/index.js";
import parseSymbols from "./parseSymbols/index.js";

export const InspectInput = z.object({
	name: z.string().describe("Symbol name to look up"),
	file: z.string().optional().describe("Optional file path to narrow search to a single file"),
});

/**
 * Locate a named symbol across workspace source files and return its kind,
 * signature, JSDoc, file, and line number.
 *
 * Flow: walk files (all or one when `file` is given) → read each file →
 * parse symbols via the TypeScript AST → filter to exact name matches →
 * convert absolute paths to POSIX-relative paths → return hits.
 *
 * When no match is found, returns `{ hits: [] }`. The MCP layer is
 * responsible for formatting the not-found message.
 */
export default async function inspect(root: string, name: string, file?: string): Promise<InspectResult> {
	const hits: InspectHit[] = [];

	for await (const filePath of walk(root, file)) {
		let source: string;
		try {
			source = await readFile(filePath, "utf-8");
		} catch {
			continue;
		}

		const symbols = parseSymbols(source, filePath);

		for (const symbol of symbols) {
			if (symbol.name !== name) continue;

			const relativePath = relative(root, symbol.file).split("\\").join("/");

			hits.push({
				name: symbol.name,
				kind: symbol.kind,
				file: relativePath,
				line: symbol.line,
				signature: symbol.signature,
				jsdoc: symbol.jsdoc,
			});
		}
	}

	return { hits };
}
