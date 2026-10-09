import aidePackage from "@/service/install/shared/aidePackage/index.js";
import type { BehindNotice } from "@/types/index.js";
import readAideLaunchMode from "./readAideLaunchMode/index.js";
import fetchLatestVersion from "./fetchLatestVersion/index.js";
import isVersionBehind from "./isVersionBehind/index.js";

/**
 * Soft notice for globally launched servers only: reports the installed and
 * latest published versions when the running server is behind npm. Silent
 * (null) on any failure, a non-global launch, an unknown version, or when
 * up to date. Never throws and never gates the pipeline.
 */
export default async function resolveBehind(
	root: string,
	serverVersion: string,
): Promise<BehindNotice | null> {
	// Step 1 — only a global launch is eligible for the notice.
	const mode = await readAideLaunchMode(root);
	if (mode !== "global") return null;

	// Step 2 — without a known installed version there is nothing to compare.
	if (serverVersion === "unknown") return null;

	// Step 3 — ask npm for the latest version; offline or failed is silent.
	const latest = await fetchLatestVersion(aidePackage.name);
	if (latest === null) return null;

	// Step 4 — report only when strictly behind.
	return isVersionBehind(serverVersion, latest) ? { installed: serverVersion, latest } : null;
}
