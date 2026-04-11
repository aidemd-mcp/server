import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import { getMethodologyMarker } from "@/tools/init/initContent/index.js";

/** Placeholder token inside the stub template that names the host-side
 * doc hub path. writeMethodology substitutes this at install time with
 * the caller-supplied relative path, so the stub's pointer and the
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
only what the task actually needs — the hub is organized for
progressive disclosure, not for front-loading.

**Before writing, editing, or acting on any \`.aide\` file, crawl the hub
and read the canonical doc that governs the work you are about to do.**
Never guess AIDE rules from memory: the files under \`${HUB_PATH_PLACEHOLDER}/\` are
the authoritative source, and any decision that disagrees with them is
wrong by definition.
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
 * STUB_TEMPLATE with the host-side hub path substituted in; marker
 * comments wrap it for idempotency detection.
 */
function composeStub(docHubDir: string): string {
	const marker = getMethodologyMarker();
	const body = STUB_TEMPLATE.replaceAll(HUB_PATH_PLACEHOLDER, docHubDir);
	return `${marker}\n${body}\n${marker}`;
}

/**
 * Install the AIDE pointer stub into the host's agent config file.
 *
 * The stub is a short marker-bounded region that tells the agent AIDE
 * exists, names the host-side doc hub at `docHubDir`, and instructs the
 * agent to crawl the hub before writing or acting on any `.aide` file.
 * The full canonical methodology does NOT live here — it lives in the
 * installed doc hub that the sibling helper lands on disk — so every
 * non-AIDE session in the host project pays only the stub cost on every
 * read of the config file.
 *
 * `docHubDir` is the host-relative form (e.g. `.aide`) because the stub
 * renders it as a display string the agent will read, not as a
 * filesystem target. The sibling installer receives the absolute form
 * separately; both derive from `FrameworkConfig.docHubDir`.
 *
 * Idempotency is marker-based: if the opening marker is already present
 * in the config file, the helper returns `exists` and writes nothing.
 * Upgrades are always explicit and belong to a future update path.
 */
export default async function writeMethodology(
	configPath: string,
	docHubDir: string,
): Promise<InitStepResult> {
	const existing = await safeReadFile(configPath);
	const marker = getMethodologyMarker();

	if (existing.includes(marker)) return { name: "Methodology pointer", status: "exists" };

	const stub = composeStub(docHubDir);
	const content = existing ? `${existing}\n\n${stub}\n` : `${stub}\n`;

	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, content, "utf-8");
	return { name: "Methodology pointer", status: "created" };
}
