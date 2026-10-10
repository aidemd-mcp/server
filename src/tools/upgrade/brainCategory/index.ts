import type { BrainCategoryResult, BrainChangeTarget } from "@/types/index.js";
import resolveProjectRoot from "../resolveProjectRoot/index.js";
import applyChange from "./applyChange/index.js";
import insertMissingSections from "./insertMissingSections/index.js";
import previewChange from "./previewChange/index.js";

/**
 * The brain category of `aide_upgrade`, dispatched by which inputs are present:
 *
 * - no `brainChange` — inserts every missing section tool-side (`insertMissingSections`);
 * - `brainChange` without `beforeHash` — previews that one stale section or the legacy
 *   launcher as a before/after diff with its byte-exact hash, read-only (`previewChange`);
 * - `brainChange` with `beforeHash` — applies that one change only if its bytes are
 *   unchanged since the preview (`applyChange`).
 *
 * An apply cannot happen without a hash only a preview produces, so a bare category call
 * can never migrate an existing section.
 */
export default async function brainCategory({
	root,
	path,
	brainChange,
	beforeHash,
}: {
	root: string;
	path?: string;
	brainChange?: BrainChangeTarget;
	beforeHash?: string;
}): Promise<BrainCategoryResult> {
	// 1. Address the same project detection does.
	const projectRoot = resolveProjectRoot(root, path);

	// 2. No selector: insert what is missing.
	if (!brainChange) return insertMissingSections({ projectRoot });

	// 3. Selector without a hash: read-only preview of the one change.
	if (!beforeHash) return previewChange({ projectRoot, target: brainChange });

	// 4. Selector with the previewed hash: the guarded apply.
	return applyChange({ projectRoot, target: brainChange, beforeHash });
}
