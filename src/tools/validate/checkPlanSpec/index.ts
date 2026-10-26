import { basename, dirname } from "node:path";
import type { AideFile, ValidationWarning } from "@/types/index.js";

/** The two canonical intent-spec file names; any other `<name>.aide` is not the spec a plan builds toward. */
const SPEC_NAMES = new Set([".aide", "intent.aide"]);

/**
 * Warns once for every plan.aide whose folder holds no intent spec. Decides by
 * file name alone, never by the scanner's `type` tag, because the tag calls
 * `session.aide`, `brain.aide` and any other `<name>.aide` an intent file and
 * none of those is the contract a plan builds toward. Pure: reads only the
 * scanned file list, so an unreadable file cannot abort it.
 */
export default function checkPlanSpec(files: AideFile[]): ValidationWarning[] {
	const namesByFolder = new Map<string, Set<string>>();
	for (const file of files) {
		const folder = dirname(file.path);
		const names = namesByFolder.get(folder) ?? new Set<string>();
		names.add(basename(file.path));
		namesByFolder.set(folder, names);
	}

	return files
		.filter((file) => basename(file.path) === "plan.aide")
		.filter((plan) => ![...namesByFolder.get(dirname(plan.path))!].some((name) => SPEC_NAMES.has(name)))
		.map((plan) => ({
			kind: "plan-without-spec",
			path: plan.relativePath,
			message: "plan.aide has no intent spec (.aide or intent.aide) beside it; write the folder's intent spec first.",
		}));
}
