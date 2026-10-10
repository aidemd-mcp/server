import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import brainContract from "@/service/brainContract/index.js";
import { parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import { isTemplateIntegration, planBrainRepair } from "@/service/install/provisionBrain/index.js";
import type { BrainCategoryResult } from "@/types/index.js";
import detectLineEnding from "../shared/detectLineEnding/index.js";
import invalidResultInstructions from "../shared/invalidResultInstructions/index.js";
import readBrainConfig from "../shared/readBrainConfig/index.js";
import refuseUnusableConfig from "../shared/refuseUnusableConfig/index.js";
import spliceRepairs from "./spliceRepairs/index.js";

/**
 * The brain category's default action: inserts every missing contract section into
 * `.aide/config/brain.aide` and returns a markers-only manifest (never section bytes).
 *
 * Insertion only: no existing byte of the file moves, and stale sections, customized
 * sections, the frontmatter and the launcher are never touched. Template text is written only
 * when the config launches the template's own integration; otherwise nothing is written and
 * the result names the sections the user must adapt with the agent. Re-running with nothing
 * missing writes nothing and reports an empty manifest. The spliced text is parsed before the
 * write and must come out `ok`, so a placement bug can never reach the user's file.
 */
export default async function insertMissingSections({
	projectRoot,
}: {
	projectRoot: string;
}): Promise<BrainCategoryResult> {
	// Read the file once so the splice works from exactly the bytes that were parsed.
	const { raw, parse } = await readBrainConfig(projectRoot);

	// Missing, unreadable and malformed files cannot be repaired by insertion.
	const refusal = refuseUnusableConfig(parse);
	if (refusal) return refusal;

	// Nothing missing: a re-run is a no-op and writes nothing.
	if (parse.kind === "ok") return { outcome: "inserted", inserted: [] };
	if (parse.kind !== "missing-sections" || raw === null) {
		throw new Error(`insertMissingSections reached an unusable parse: ${parse.kind}`);
	}

	// Verbatim template text may only land in the template's own integration.
	if (!isTemplateIntegration(parse.mcpServerConfig)) {
		return {
			outcome: "adapt",
			adapt: parse.sections,
			instructions:
				'This brain config launches a different brain server than the bundled template targets, so no template text was inserted. For each section in `adapt`, call `aide_upgrade` with `category: "brain"` and `brainChange` set to its marker to read the template\'s version, write a version for this config\'s brain with the user between that section\'s markers, then re-check brain state with `aide_info`.',
		};
	}

	// The planner owns block bytes and anchors; the splice converts them to the file's line ending.
	const repairs = planBrainRepair(parse);
	if (!repairs) throw new Error("planBrainRepair returned no plan for a missing-sections parse");
	const text = spliceRepairs({ raw, repairs, eol: detectLineEnding(raw) });

	// Validate before writing: only a fully valid result may reach the user's file.
	if (parseBrainAideFromString(text).kind !== "ok") {
		return {
			outcome: "refused",
			instructions: invalidResultInstructions(),
		};
	}

	await writeFile(join(projectRoot, ".aide", "config", "brain.aide"), text, "utf-8");

	// Derive the manifest from the contract so each marker keeps its literal type; the planner emits contract order.
	const insertedMarkers = new Set(repairs.map(({ marker }) => marker));
	return {
		outcome: "inserted",
		inserted: brainContract.map(({ marker }) => marker).filter((marker) => insertedMarkers.has(marker)),
	};
}
