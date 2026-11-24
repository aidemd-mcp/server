import type { RootPaths } from "../types/index.js";
import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";

const OBSERVER_FILE = "observer.json";

/**
 * Resolve the per-user locations shared by every project: the app-data root and
 * the one `observer.json` inside it. Takes no project, so no caller can resolve
 * the observer's record "for a project" and miss the observer running for
 * another. Pure: never touches the filesystem.
 */
export default function resolveRoot(): RootPaths {
	const root = resolveAppDataRoot();

	return { root, observerFile: pickPathModule().join(root, OBSERVER_FILE) };
}
