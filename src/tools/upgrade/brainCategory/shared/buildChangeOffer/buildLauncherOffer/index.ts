import { detectBrainMigration } from "@/service/install/provisionBrain/index.js";
import type { BrainChangeOffer, ParseBrainAideResult } from "@/types/index.js";
import locateFrontmatter from "../../locateFrontmatter/index.js";
import rewriteLauncherArgs from "./rewriteLauncherArgs/index.js";
import rewriteLauncherCommand from "./rewriteLauncherCommand/index.js";

/**
 * Builds the offer to move a legacy bundled-mcpvault npx launcher to the global `mcpvault`
 * command, or the refusal that explains why none is offered:
 *
 * - launcher is current or custom (`detectBrainMigration` flags no legacy launcher) -> R7
 * - `mcpServerConfig.args` is not a block list with one scalar per line, or
 *   `mcpServerConfig.command` is not a single-line scalar, so the rewrite cannot be byte-safe
 *   -> R8, carrying the replacement launcher for a hand edit
 *
 * An npx launcher moves to `legacyLauncher.after`: the global command with the args that trailed
 * the npx spec (the vault path slot) kept. `before` is the raw frontmatter region and `after` the
 * same region with only the args item lines and the command line changed; `text` is `raw` with
 * that region replaced. Pure.
 */
export default function buildLauncherOffer({
	raw,
	parse,
	eol,
}: {
	raw: string;
	parse: ParseBrainAideResult;
	eol: "\r\n" | "\n";
}): BrainChangeOffer {
	// 1. Only a flagged legacy launcher is ever offered.
	const legacy = detectBrainMigration(parse)?.legacyLauncher ?? null;
	if (legacy === null) {
		return {
			kind: "refused",
			instructions: "The brain launcher is current or custom, so no launcher change is offered.",
		};
	}

	// 2. Rewrite the args, then the command, inside the raw frontmatter region, touching no other byte.
	const { yamlStart, yamlEnd } = locateFrontmatter(raw);
	const before = raw.slice(yamlStart, yamlEnd);
	const withArgs = rewriteLauncherArgs({
		frontmatter: before,
		before: legacy.before.args,
		after: legacy.after.args,
		eol,
	});
	const after =
		withArgs === null
			? null
			: rewriteLauncherCommand({ frontmatter: withArgs, before: legacy.before.command, after: legacy.after.command });
	if (after === null) {
		return {
			kind: "refused",
			instructions: `The launcher change cannot be applied byte-safely because \`mcpServerConfig.command\` is not a single-line scalar or \`mcpServerConfig.args\` is not a YAML block list with one entry per line. Show the user the replacement launcher ${JSON.stringify(legacy.after)} and, on their yes, edit it by hand; then re-check brain state with \`aide_info\`.`,
		};
	}

	// 3. Splice the new region over the old one.
	return {
		kind: "offer",
		target: "launcher",
		before,
		after,
		text: raw.slice(0, yamlStart) + after + raw.slice(yamlEnd),
	};
}
