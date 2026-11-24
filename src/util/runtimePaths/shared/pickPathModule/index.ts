import path from "node:path";
import { platform } from "node:os";

/**
 * Pick the path module that matches the current platform: `path.win32` on
 * Windows, `path.posix` everywhere else. Every runtimePaths helper joins and
 * resolves through this, so tests can resolve macOS and Linux paths on a
 * Windows machine (and the reverse) by mocking `platform()`.
 */
export default function pickPathModule(): path.PlatformPath {
	return platform() === "win32" ? path.win32 : path.posix;
}
