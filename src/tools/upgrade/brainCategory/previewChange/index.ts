import brainContract from "@/service/brainContract/index.js";
import { isTemplateIntegration, parseBundledTemplate } from "@/service/install/provisionBrain/index.js";
import type { BrainCategoryResult, BrainChangeTarget } from "@/types/index.js";
import buildChangeOffer from "../shared/buildChangeOffer/index.js";
import hashBytes from "../shared/hashBytes/index.js";
import readBrainConfig from "../shared/readBrainConfig/index.js";
import readChangeBefore from "../shared/readChangeBefore/index.js";
import refuseUnusableConfig from "../shared/refuseUnusableConfig/index.js";

/**
 * The brain category's read-only preview: shows the one change `target` names (a stale
 * section or the legacy launcher) as its exact `before` text, the `after` text that would
 * replace it, and the `beforeHash` of `before` that a later guarded apply must echo back.
 *
 * Never writes. A section that is absent is not a change: with the template's own integration
 * the answer points at insertion (zero template bytes), otherwise it returns the bundled
 * template's version for the agent to adapt with the user. Every other reason no change is
 * offered (current or customized section, non-template integration, launcher not legacy or not
 * byte-safe) comes back as the refusal `buildChangeOffer` produced.
 */
export default async function previewChange({
	projectRoot,
	target,
}: {
	projectRoot: string;
	target: BrainChangeTarget;
}): Promise<BrainCategoryResult> {
	// 1. Read the file once so the offer is built from exactly the bytes that were parsed.
	const { raw, parse } = await readBrainConfig(projectRoot);

	// 2. Missing, unreadable and malformed files cannot be previewed.
	const refusal = refuseUnusableConfig(parse);
	if (refusal) return refusal;
	if (raw === null) throw new Error(`previewChange reached an unread file with a usable parse: ${parse.kind}`);
	if (parse.kind !== "ok" && parse.kind !== "missing-sections") {
		throw new Error(`previewChange reached an unusable parse: ${parse.kind}`);
	}

	// 3. An absent section has no bytes to diff: insertion or a hand-adapted template covers it.
	if (target !== "launcher" && readChangeBefore({ raw, target }) === null) {
		if (isTemplateIntegration(parse.mcpServerConfig)) {
			return {
				outcome: "refused",
				instructions: `Section \`${target}\` is missing. With the user's consent, insert it with \`aide_upgrade\` and \`category: "brain"\` (no \`brainChange\`).`,
			};
		}
		const entry = brainContract.find(({ marker }) => marker === target);
		if (!entry) throw new Error(`previewChange target ${target} is not in the brain contract`);
		return {
			outcome: "missing",
			target,
			template: parseBundledTemplate()[entry.field],
			instructions: `Section \`${target}\` is missing and this config launches a different brain server than the bundled template targets. \`template\` is the bundled template's version. The \`aide-brain-author\` skill writes a version for this config's brain with the user between that section's markers, then re-checks brain state with \`aide_info\`.`,
		};
	}

	// 4. The shared builder decides whether a change is offered, exactly as apply will.
	const offer = buildChangeOffer({ raw, parse, target });
	if (offer.kind === "refused") return { outcome: "refused", instructions: offer.instructions };

	// 5. Hand out the diff and the hash of the exact bytes the diff replaces.
	return {
		outcome: "change",
		target: offer.target,
		before: offer.before,
		after: offer.after,
		beforeHash: hashBytes(offer.before),
	};
}
