import type { BrainStepSection } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import parseBundledTemplate from "../../../parseBundledTemplate/index.js";

/**
 * Lists the brain config contract as the content-free section manifest `brainSummary.sections` carries.
 *
 * One entry per contract section, in contract order: its marker, role, the seed path for seed
 * sections only, and the UTF-8 byte length of the latest bundled template's section so an agent
 * can budget a fetch. No purpose, no field name and no section text, so the manifest cannot leak
 * template bytes on any step status.
 */
export default function listBrainSections(): BrainStepSection[] {
	const template = parseBundledTemplate();
	return brainContract.map((entry) => ({
		marker: entry.marker,
		role: entry.role,
		...(entry.role === "seed" ? { seedPath: entry.seedPath } : {}),
		templateBytes: Buffer.byteLength(template[entry.field], "utf8"),
	}));
}
