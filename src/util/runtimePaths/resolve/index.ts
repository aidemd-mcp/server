import { platform } from "node:os";
import type { RuntimePaths } from "../types/index.js";
import pickPathModule from "../shared/pickPathModule/index.js";
import resolveAppDataRoot from "../shared/resolveAppDataRoot/index.js";
import { ENDED_FOLDER, EVENTS_FOLDER, PRESENCE_FOLDER } from "../shared/runtimeNames/index.js";
import nameProjectFolder from "./nameProjectFolder/index.js";

/**
 * Resolve a project's per-user runtime paths. Pure: never touches the
 * filesystem. Throws when the runtime folder would land inside the project
 * root, because runtime files must never be written into the host project.
 */
export default function resolve({ projectRoot }: { projectRoot: string }): RuntimePaths {
	const pathModule = pickPathModule();

	// Resolve the per-user app-data root.
	const appDataRoot = resolveAppDataRoot();

	// Name the project's folder under it.
	const name = nameProjectFolder({ projectRoot });

	// Build the project paths.
	const folder = pathModule.join(appDataRoot, name);
	const eventsFolder = pathModule.join(folder, EVENTS_FOLDER);
	const presenceFolder = pathModule.join(folder, PRESENCE_FOLDER);
	const endedFolder = pathModule.join(folder, ENDED_FOLDER);

	// Guard: the runtime folder must not be the project root or inside it.
	const root = pathModule.resolve(projectRoot);
	const fold = platform() === "win32" ? (value: string) => value.toLowerCase() : (value: string) => value;
	const fromRoot = pathModule.relative(fold(root), fold(folder));
	const inside = fromRoot === "" || (!fromRoot.startsWith("..") && !pathModule.isAbsolute(fromRoot));
	if (inside) {
		throw new Error(`Runtime folder "${folder}" lies inside the project root "${root}"`);
	}

	return { projectKey: name, folder, eventsFolder, presenceFolder, endedFolder };
}
