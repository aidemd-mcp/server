import { readFile } from "node:fs/promises";
import type { UpgradeFileResult } from "@/types/index.js";
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
 * Compare the canonical AIDE methodology pointer stub against what is in the
 * host's agent config file. Read-only — never writes.
 *
 * Returns an `UpgradeFileResult` with category `"pointer-stub"`:
 * - `"missing"` when the file is absent or markers are not present.
 *   `canonicalContent` is the full file content after splicing in the stub.
 * - `"matches"` when the stub in the file is byte-identical to canonical.
 * - `"differs"` when the stub exists but differs from canonical.
 *   `canonicalContent` is the full file content after splicing in the stub.
 */
export default async function spliceStub(
	configPath: string,
	docHubDir: string,
): Promise<UpgradeFileResult> {
	const marker = getMethodologyMarker();
	const canonical = composeStub(docHubDir);

	const existing = await safeReadFile(configPath);

	// File missing or marker absent — treat as a fresh install.
	if (existing === undefined || !existing.includes(marker)) {
		const canonicalContent =
			existing !== undefined && existing.length > 0
				? `${existing}\n\n${canonical}\n`
				: `${canonical}\n`;
		return {
			name: STEP_NAME,
			filePath: configPath,
			status: "missing",
			category: "pointer-stub",
			canonicalContent,
		};
	}

	// Marker pair found — locate the bounded region.
	const region = findMarkerRegion(existing, marker);
	if (region === null) {
		// Opening marker present but no closing marker — treat as absent stub.
		const canonicalContent = `${existing}\n\n${canonical}\n`;
		return {
			name: STEP_NAME,
			filePath: configPath,
			status: "missing",
			category: "pointer-stub",
			canonicalContent,
		};
	}

	// Extract the current stub and compare to the canonical form.
	const current = existing.slice(region.start, region.end);
	if (current === canonical) {
		return {
			name: STEP_NAME,
			filePath: configPath,
			status: "matches",
			category: "pointer-stub",
		};
	}

	// Stubs differ — compute the spliced content for the agent to write.
	const before = existing.slice(0, region.start);
	const after = existing.slice(region.end);
	const canonicalContent = `${before}${canonical}${after}`;
	return {
		name: STEP_NAME,
		filePath: configPath,
		status: "differs",
		category: "pointer-stub",
		canonicalContent,
	};
}
