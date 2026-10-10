import type { BrainChangeOffer, BrainChangeTarget, ParseBrainAideResult } from "@/types/index.js";
import detectLineEnding from "../detectLineEnding/index.js";
import buildLauncherOffer from "./buildLauncherOffer/index.js";
import buildSectionOffer from "./buildSectionOffer/index.js";

/**
 * Builds the one change a preview shows and an apply writes, or the refusal that explains why
 * none is offered. Preview and apply both call this, so they cannot disagree about the bytes.
 *
 * Callers refuse unusable files first: `parse` must be `ok` or `missing-sections`. The file's
 * line ending is detected once here and handed to whichever builder the target selects.
 */
export default function buildChangeOffer({
	raw,
	parse,
	target,
}: {
	raw: string;
	parse: ParseBrainAideResult;
	target: BrainChangeTarget;
}): BrainChangeOffer {
	if (parse.kind !== "ok" && parse.kind !== "missing-sections") {
		throw new Error(`buildChangeOffer requires a usable parse, got: ${parse.kind}`);
	}

	const eol = detectLineEnding(raw);
	if (target === "launcher") return buildLauncherOffer({ raw, parse, eol });
	return buildSectionOffer({ raw, parse, marker: target, eol });
}
