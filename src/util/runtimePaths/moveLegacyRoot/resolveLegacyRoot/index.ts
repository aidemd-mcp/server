import { platform, homedir } from "node:os";
import pickPathModule from "../../shared/pickPathModule/index.js";

/**
 * The pre-fix Windows per-user root, or null when there is nothing to move from: not
 * Windows, or `AIDEMD_HOME` is set to an absolute path (the override isolates the root, so
 * the move must never run). The formula is the old one, verbatim: `LOCALAPPDATA` when set,
 * non-empty and absolute, else `<home>\AppData\Local`, joined with `aidemd`. In a packaged
 * process the OS maps that path to the package's private copy, so each process sees its own
 * old history. Pure: no fs access.
 */
export default function resolveLegacyRoot(): string | null {
	if (platform() !== "win32") return null;

	const pathModule = pickPathModule();
	const override = process.env.AIDEMD_HOME;
	if (override && pathModule.isAbsolute(override)) return null;

	const localAppData = process.env.LOCALAPPDATA;
	const base = localAppData && pathModule.isAbsolute(localAppData)
		? localAppData
		: pathModule.join(homedir(), "AppData", "Local");
	return pathModule.join(base, "aidemd");
}
