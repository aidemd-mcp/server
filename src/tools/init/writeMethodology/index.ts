import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import {
	readCanonicalDoc,
	getMethodologyMarker,
	type CanonicalDocName,
} from "@/tools/init/initContent/index.js";

/**
 * Order in which the canonical methodology docs concatenate to form the body
 * of the methodology block. This composition used to live in initContent as a
 * bridge shim; it now lives here because the .aide spec puts composition on
 * the consumer side (writeMethodology) and reading on the reader side
 * (initContent). The names are canonical doc identifiers, not file paths —
 * initContent owns the name-to-path mapping.
 */
const METHODOLOGY_DOCS: readonly CanonicalDocName[] = [
	"aide-spec",
	"aide-template",
	"progressive-disclosure",
	"agent-readable-code",
	"automated-qa",
];

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Compose the methodology block from the canonical docs on disk. Header,
 * opening marker, body, closing marker — all assembled here from bytes
 * returned verbatim by initContent. No AIDE doctrine as literals lives in
 * this function; every word of substance comes from docs/.
 */
function composeMethodologyBlock(): string {
	const marker = getMethodologyMarker();
	const body = METHODOLOGY_DOCS.map((name) => readCanonicalDoc(name)).join("\n\n");
	return `${marker}\n${body}\n${marker}`;
}

/** Write methodology to the agent config file if not already present. */
export default async function writeMethodology(configPath: string): Promise<InitStepResult> {
	const existing = await safeReadFile(configPath);
	const marker = getMethodologyMarker();

	if (existing.includes(marker)) return { name: "Methodology", status: "exists" };

	const methodology = composeMethodologyBlock();
	const content = existing ? `${existing}\n\n${methodology}\n` : `${methodology}\n`;

	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, content, "utf-8");
	return { name: "Methodology", status: "created" };
}
