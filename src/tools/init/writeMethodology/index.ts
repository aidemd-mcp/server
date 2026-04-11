import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { InitStepResult } from "@/types/index.js";
import {
	readCanonicalDoc,
	getMethodologyMarker,
} from "@/tools/init/initContent/index.js";

/** Placeholder token inside the canonical stub that names the host-side
 * doc hub path. writeMethodology substitutes this at install time with
 * the caller-supplied relative path, so the stub's pointer and the
 * installer's write target derive from a single shared source. */
const HUB_PATH_PLACEHOLDER = "{{HUB_PATH}}";

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Compose the marker-bounded pointer stub. The stub body comes from the
 * canonical `methodology-stub` doc read through initContent — every
 * teaching sentence inside the body lives in `docs/`, not in this
 * helper's source. This function only handles framework plumbing: the
 * host-path substitution, the surrounding marker comments, and the
 * newlines that separate them from the rest of the config file. If a
 * future change reintroduces hand-written doctrine here, it is the
 * exact regression the parent spec's single-source-of-truth invariant
 * exists to prevent.
 */
function composeStub(docHubDir: string): string {
	const marker = getMethodologyMarker();
	const body = readCanonicalDoc("methodology-stub").replaceAll(
		HUB_PATH_PLACEHOLDER,
		docHubDir,
	);
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
