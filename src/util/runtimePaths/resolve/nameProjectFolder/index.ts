import { createHash } from "node:crypto";
import { platform } from "node:os";
import { HASH_LENGTH } from "../../shared/projectKeyHash/index.js";
import pickPathModule from "../../shared/pickPathModule/index.js";

const FALLBACK_NAME = "project";

/**
 * Name a project's runtime folder: `<folder name>-<6 hex>`. The hash is the
 * SHA-256 of the normalized absolute project root (lowercased on Windows only,
 * where paths are case-insensitive), so two projects with the same folder name
 * never share a runtime folder. A relative root throws rather than resolving
 * against the process cwd, which would silently key the wrong project.
 */
export default function nameProjectFolder({ projectRoot }: { projectRoot: string }): string {
	const pathModule = pickPathModule();

	if (!pathModule.isAbsolute(projectRoot)) {
		throw new Error(`Project root must be an absolute path, got "${projectRoot}"`);
	}

	const normalized = pathModule.resolve(projectRoot);
	const name = pathModule.basename(normalized) || FALLBACK_NAME;
	const hashInput = platform() === "win32" ? normalized.toLowerCase() : normalized;
	const hash = createHash("sha256").update(hashInput, "utf8").digest("hex").slice(0, HASH_LENGTH);

	return `${name}-${hash}`;
}
