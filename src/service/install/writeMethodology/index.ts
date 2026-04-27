import { readFile } from "node:fs/promises";
import type { InitStep } from "@/types/index.js";
import { getMethodologyMarker } from "@/service/install/initContent/index.js";

/** Placeholder token inside the stub template that names the host-side
 * doc directory path. writeMethodology substitutes this at install time
 * with the caller-supplied relative path, so the stub's pointer and the
 * installer's write target derive from a single shared source. */
const HUB_PATH_PLACEHOLDER = "{{HUB_PATH}}";

/**
 * The pointer stub written into the host's agent config file. This is
 * framework plumbing — not AIDE doctrine — because its only job is to
 * tell the agent where the canonical docs live and that they must be
 * crawled before acting on any `.aide` file. The doctrine itself lives
 * in the canonical docs the stub points at; this template just routes
 * the agent there.
 */
const STUB_TEMPLATE = `## AIDE — Autonomous Intent-Driven Engineering

This project uses the AIDE methodology. AIDE treats a short \`.aide\` intent
spec living next to orchestrator code as the contract every downstream
agent (architect, implementor, QA) works from — when the intent changes,
the code changes.

The full canonical methodology is installed in this project at
\`${HUB_PATH_PLACEHOLDER}/\`. Start at \`${HUB_PATH_PLACEHOLDER}/index.md\` for the doc list, then
crawl into the specific canonical doc your current task requires. Read
only what the task actually needs — the doc directory is organized for
progressive disclosure, not for front-loading.

**Before writing, editing, or acting on any \`.aide\` file, crawl the doc directory
and read the canonical doc that governs the work you are about to do.**
Never guess AIDE rules from memory: the files under \`${HUB_PATH_PLACEHOLDER}/\` are
the authoritative source, and any decision that disagrees with them is
wrong by definition.

**AIDE tools quick-reference:**
- \`aide_discover\` — map where \`.aide\` specs live in the project
- \`aide_read\` — read a specific \`.aide\` file with context
- \`aide_scaffold\` — create a new \`.aide\` file
- \`aide_validate\` — check spec layout for drift or issues
- \`aide_init\` — bootstrap AIDE into a new project (first-time setup)
- \`aide_upgrade\` — update/sync/refresh AIDE docs, commands, agents, and skills to the latest canonical versions (use this when asked to "update AIDE", "update the docs", or "sync the methodology")
`;

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Compose the marker-bounded pointer stub. The body is the inlined
 * STUB_TEMPLATE with the host-side doc directory path substituted in; marker
 * comments wrap it for idempotency detection.
 */
export function composeStub(docHubDir: string): string {
	const marker = getMethodologyMarker();
	const body = STUB_TEMPLATE.replaceAll(HUB_PATH_PLACEHOLDER, docHubDir);
	return `${marker}\n${body}\n${marker}`;
}

/**
 * Extract the bytes between the first and last occurrence of the marker in
 * `fileContent` (inclusive of both markers). Returns null when the marker
 * appears fewer than twice (i.e. the marker pair is absent or malformed).
 */
function extractMarkerBlock(fileContent: string, marker: string): string | null {
	const start = fileContent.indexOf(marker);
	if (start === -1) return null;
	const end = fileContent.indexOf(marker, start + marker.length);
	if (end === -1) return null;
	return fileContent.slice(start, end + marker.length);
}

/**
 * Replace the marker-bounded block inside `fileContent` with `replacement`,
 * preserving all content outside the block. Returns the full updated string.
 */
function replaceMarkerBlock(fileContent: string, marker: string, replacement: string): string {
	const start = fileContent.indexOf(marker);
	const end = fileContent.indexOf(marker, start + marker.length) + marker.length;
	return fileContent.slice(0, start) + replacement + fileContent.slice(end);
}

/**
 * Inspect the host's agent config file and return a planning step for the
 * AIDE methodology pointer stub.
 *
 * - Marker absent: returns `would-create` with the composed stub appended to
 *   any existing content.
 * - Marker present, stub body identical to canonical: returns `exists`.
 * - Marker present, stub body drifted from canonical: returns `would-overwrite`
 *   with `content` set to the full file with the drifted block replaced
 *   in-place, so `applySteps` can write the whole file.
 *
 * This helper never writes to disk — it is a planner only. `composeStub`
 * remains a named export so upgrade's `spliceStub` can continue to use it.
 */
export default async function writeMethodology(
	configPath: string,
	docHubDir: string,
): Promise<InitStep> {
	const existing = await safeReadFile(configPath);
	const marker = getMethodologyMarker();
	const stub = composeStub(docHubDir);

	const block = extractMarkerBlock(existing, marker);
	if (block === null) {
		const content = existing ? `${existing}\n\n${stub}\n` : `${stub}\n`;
		return {
			name: "Methodology pointer",
			status: "would-create",
			category: "methodology",
			filePath: configPath,
			content,
		};
	}

	if (block === stub) {
		return {
			name: "Methodology pointer",
			status: "exists",
			category: "methodology",
			filePath: configPath,
		};
	}

	return {
		name: "Methodology pointer",
		status: "would-overwrite",
		category: "methodology",
		filePath: configPath,
		content: replaceMarkerBlock(existing, marker, stub),
	};
}
