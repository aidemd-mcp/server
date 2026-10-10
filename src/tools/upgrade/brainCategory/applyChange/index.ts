import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrainCategoryResult, BrainChangeTarget } from "@/types/index.js";
import yieldsExpectedConfig from "./yieldsExpectedConfig/index.js";
import buildChangeOffer from "../shared/buildChangeOffer/index.js";
import changedSinceDiff from "../shared/changedSinceDiff/index.js";
import hashBytes from "../shared/hashBytes/index.js";
import invalidResultInstructions from "../shared/invalidResultInstructions/index.js";
import readBrainConfig from "../shared/readBrainConfig/index.js";
import readChangeBefore from "../shared/readChangeBefore/index.js";
import refuseUnusableConfig from "../shared/refuseUnusableConfig/index.js";

/**
 * The brain category's guarded apply: writes the one change `target` names, but only when the
 * bytes it replaces are exactly the bytes the user was shown.
 *
 * `beforeHash` is the hash a preview returned for the change's `before` text. The current
 * bytes are re-hashed with no normalization, so any edit since the preview (even whitespace)
 * refuses with the re-fetch instruction and writes nothing. A matching hash is not enough on
 * its own: the offer is rebuilt exactly as the preview builds it, so a section that is no
 * longer a known outdated template version (customized, current, other integration) is
 * refused too. The spliced text is parsed before the write and must be the expected result,
 * so a splice bug can never reach the user's file. Exactly one change is written per call.
 */
export default async function applyChange({
	projectRoot,
	target,
	beforeHash,
}: {
	projectRoot: string;
	target: BrainChangeTarget;
	beforeHash: string;
}): Promise<BrainCategoryResult> {
	// 1. Read the file once so the guard, the offer and the splice all use the same bytes.
	const { raw, parse } = await readBrainConfig(projectRoot);

	// 2. Missing, unreadable and malformed files cannot be changed.
	const refusal = refuseUnusableConfig(parse);
	if (refusal) return refusal;
	if (raw === null) throw new Error(`applyChange reached an unread file with a usable parse: ${parse.kind}`);
	if (parse.kind !== "ok" && parse.kind !== "missing-sections") {
		throw new Error(`applyChange reached an unusable parse: ${parse.kind}`);
	}

	// 3. The target must still exist, and its exact current bytes must hash to what the user saw.
	const current = readChangeBefore({ raw, target });
	if (current === null || hashBytes(current) !== beforeHash) {
		return { outcome: "refused", instructions: changedSinceDiff(target) };
	}

	// 4. Rebuild the offer exactly as the preview does; anything not offerable is refused as it was there.
	const offer = buildChangeOffer({ raw, parse, target });
	if (offer.kind === "refused") return { outcome: "refused", instructions: offer.instructions };

	// 5. Validate the spliced text before it can reach the user's file.
	if (!yieldsExpectedConfig({ parse, offer })) {
		return {
			outcome: "refused",
			instructions: invalidResultInstructions(),
		};
	}

	// 6. Write the one change.
	await writeFile(join(projectRoot, ".aide", "config", "brain.aide"), offer.text, "utf-8");
	return { outcome: "applied", target };
}
