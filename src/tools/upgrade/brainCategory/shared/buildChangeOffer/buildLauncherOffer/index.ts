import { detectBrainMigration } from "@/service/install/provisionBrain/index.js";
import type { BrainChangeOffer, ParseBrainAideResult } from "@/types/index.js";
import locateFrontmatter from "../../locateFrontmatter/index.js";
import rewriteLauncherArgs from "./rewriteLauncherArgs/index.js";

/**
 * Builds the offer to bring a legacy bundled-mcpvault npx launcher up to date, or the refusal
 * that explains why none is offered:
 *
 * - launcher is current or custom (`detectBrainMigration` flags no legacy launcher) -> R7
 * - `mcpServerConfig.args` is not a block list with one scalar per line, so the rewrite cannot
 *   be byte-safe -> R8, carrying the replacement args for a hand edit
 *
 * The change always targets `legacyLauncher.after.local`: a legacy launcher is local by
 * definition and the entry stays in its existing mode. `before` is the raw frontmatter region
 * and `after` the same region with only the args item lines changed; `text` is `raw` with that
 * region replaced. Pure.
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

	// 2. Rewrite the args inside the raw frontmatter region, touching no other byte.
	const { yamlStart, yamlEnd } = locateFrontmatter(raw);
	const before = raw.slice(yamlStart, yamlEnd);
	const after = rewriteLauncherArgs({
		frontmatter: before,
		before: legacy.before.args,
		after: legacy.after.local.args,
		eol,
	});
	if (after === null) {
		return {
			kind: "refused",
			instructions: `The launcher change cannot be applied byte-safely because \`mcpServerConfig.args\` is not a YAML block list with one entry per line. Show the user the replacement args ${JSON.stringify(legacy.after.local.args)} and, on their yes, edit them by hand; then re-check brain state with \`aide_info\`.`,
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
