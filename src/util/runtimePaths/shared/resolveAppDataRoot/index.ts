import { platform, homedir } from "node:os";
import pickPathModule from "../pickPathModule/index.js";

const APP_FOLDER = "aidemd";

/**
 * The per-user base folder for AIDE's runtime files: `<per-OS base>/aidemd`.
 * Windows: `%LOCALAPPDATA%` when set, non-empty and absolute, else
 * `<home>\AppData\Local`. macOS: `<home>/Library/Application Support`.
 * Everywhere else: `$XDG_STATE_HOME` when set, non-empty and absolute (the XDG
 * spec ignores relative values), else `<home>/.local/state`. Pure: no fs access.
 */
export default function resolveAppDataRoot(): string {
	const pathModule = pickPathModule();
	const home = homedir();

	if (platform() === "win32") {
		const localAppData = process.env.LOCALAPPDATA;
		const base = localAppData && pathModule.isAbsolute(localAppData)
			? localAppData
			: pathModule.join(home, "AppData", "Local");
		return pathModule.join(base, APP_FOLDER);
	}

	if (platform() === "darwin") {
		return pathModule.join(home, "Library", "Application Support", APP_FOLDER);
	}

	const stateHome = process.env.XDG_STATE_HOME;
	const base = stateHome && pathModule.isAbsolute(stateHome)
		? stateHome
		: pathModule.join(home, ".local", "state");
	return pathModule.join(base, APP_FOLDER);
}
