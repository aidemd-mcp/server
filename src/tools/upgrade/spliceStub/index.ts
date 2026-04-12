import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { UpgradeStepResult } from "@/types/index.js";
import { getMethodologyMarker } from "@/tools/init/initContent/index.js";
import { composeStub } from "@/tools/init/writeMethodology/index.js";

const STEP_NAME = "Methodology pointer";

/** Read a file, returning undefined if it doesn't exist. */
async function safeReadFile(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return undefined;
	}
}

/**
 * Locate the marker-bounded region in `content`. Returns the start index of
 * the opening marker and the end index (exclusive) after the closing marker,
 * or null if the region is not present or malformed.
 */
function findMarkerRegion(
	content: string,
	marker: string,
): { start: number; end: number } | null {
	const openStart = content.indexOf(marker);
	if (openStart === -1) return null;

	const searchFrom = openStart + marker.length;
	const closeStart = content.indexOf(marker, searchFrom);
	if (closeStart === -1) return null;

	return { start: openStart, end: closeStart + marker.length };
}

/**
 * Splice the canonical AIDE methodology pointer stub into the host's agent
 * config file, or create the file when it is absent.
 *
 * Behaviour:
 * - File missing or marker absent → append (or create) the stub.
 *   Returns `"created"` on write, `"would create"` on dry-run.
 * - Marker pair present and stub matches canonical → no write.
 *   Returns `"unchanged"`.
 * - Marker pair present and stub differs → replace the bounded region.
 *   Returns `"updated"` on write, `"would update"` on dry-run.
 *
 * The splice preserves every byte before the opening marker and every byte
 * after the closing marker, changing only the marker-bounded region itself.
 */
export default async function spliceStub(
	configPath: string,
	docHubDir: string,
	write: boolean,
): Promise<UpgradeStepResult> {
	const marker = getMethodologyMarker();
	const canonical = composeStub(docHubDir);

	const existing = await safeReadFile(configPath);

	// File missing or marker absent — treat as a fresh install.
	if (existing === undefined || !existing.includes(marker)) {
		if (write) {
			const content =
				existing !== undefined && existing.length > 0
					? `${existing}\n\n${canonical}\n`
					: `${canonical}\n`;
			await mkdir(dirname(configPath), { recursive: true });
			await writeFile(configPath, content, "utf-8");
		}
		return { name: STEP_NAME, status: write ? "created" : "would create" };
	}

	// Marker pair found — locate the bounded region.
	const region = findMarkerRegion(existing, marker);
	if (region === null) {
		// Opening marker present but no closing marker — treat as absent stub.
		if (write) {
			const content = `${existing}\n\n${canonical}\n`;
			await writeFile(configPath, content, "utf-8");
		}
		return { name: STEP_NAME, status: write ? "created" : "would create" };
	}

	// Extract the current stub and compare to the canonical form.
	const current = existing.slice(region.start, region.end);
	if (current === canonical) {
		return { name: STEP_NAME, status: "unchanged" };
	}

	// Stubs differ — splice the canonical stub in place of the old region.
	if (write) {
		const before = existing.slice(0, region.start);
		const after = existing.slice(region.end);
		const spliced = `${before}${canonical}${after}`;
		await writeFile(configPath, spliced, "utf-8");
	}
	return { name: STEP_NAME, status: write ? "updated" : "would update" };
}
