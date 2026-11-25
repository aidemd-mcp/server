import { platform, homedir } from "node:os";
import pickPathModule from "../pickPathModule/index.js";

const APP_FOLDER = "aidemd";
const WINDOWS_APP_FOLDER = ".aidemd";

/**
 * The per-user base folder for AIDE's runtime files. `AIDEMD_HOME` wins on every
 * OS when set, non-empty and absolute: it is the root itself, unjoined (empty or
 * relative values are ignored). Otherwise Windows: `<home>\.aidemd`, in the
 * profile folder rather than AppData, because MSIX-packaged apps (the Claude
 * desktop app) get their AppData writes redirected into a private package copy
 * while the profile folder is not redirected. macOS: `<home>/Library/Application
 * Support/aidemd`. Everywhere else: `$XDG_STATE_HOME/aidemd` when set, non-empty
 * and absolute (the XDG spec ignores relative values), else
 * `<home>/.local/state/aidemd`. Pure: no fs access.
 */
export default function resolveAppDataRoot(): string {
	const pathModule = pickPathModule();
	const home = homedir();

	const override = process.env.AIDEMD_HOME;
	if (override && pathModule.isAbsolute(override)) return override;

	if (platform() === "win32") return pathModule.join(home, WINDOWS_APP_FOLDER);

	if (platform() === "darwin") {
		return pathModule.join(home, "Library", "Application Support", APP_FOLDER);
	}

	const stateHome = process.env.XDG_STATE_HOME;
	const base = stateHome && pathModule.isAbsolute(stateHome)
		? stateHome
		: pathModule.join(home, ".local", "state");
	return pathModule.join(base, APP_FOLDER);
}
