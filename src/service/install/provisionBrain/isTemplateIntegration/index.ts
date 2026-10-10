import type { BrainAideMcpServerConfig } from "@/types/index.js";
import normalizeLaunchedCommand from "../../shared/normalizeLaunchedCommand/index.js";
import { MCPVAULT_COMMAND, MCPVAULT_PACKAGE } from "../obsidianBrainAideTemplate/index.js";

/**
 * Judges whether a brain config's integration is the one the bundled template
 * targets, so verbatim template text may land only in the template's own backend.
 *
 * The signal is the launcher, never the frontmatter `name`: `name` is
 * descriptive-only by contract and no package code branches on it. The launched
 * program (via `normalizeLaunchedCommand`, so `cmd /c` and path/extension forms are
 * covered) must be `MCPVAULT_COMMAND`, or `npx` with any string arg equal to
 * `MCPVAULT_PACKAGE` or pinned as `MCPVAULT_PACKAGE@<version>`. Null unwired-slot
 * args are skipped. A false negative falls to the adapt path, which is safe; a
 * false positive would paste template text into another backend. Pure.
 */
export default function isTemplateIntegration(config: BrainAideMcpServerConfig): boolean {
	const launched = normalizeLaunchedCommand(config);
	if (launched === null) return false;
	if (launched.token === MCPVAULT_COMMAND) return true;
	if (launched.token !== "npx") return false;

	return config.args.some(
		(arg) => typeof arg === "string" && (arg === MCPVAULT_PACKAGE || arg.startsWith(`${MCPVAULT_PACKAGE}@`)),
	);
}
