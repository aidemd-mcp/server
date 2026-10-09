import { join } from "node:path";
import type { UpgradeFileResult } from "@/types/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";

/**
 * Reports whether the host's brain config is at the required-section contract.
 * Parses `.aide/config/brain.aide` through `parseBrainAide` (the only read it
 * performs) and maps the parse result onto the upgrade comparison vocabulary:
 *
 * - `ok` -> `"matches"`
 * - `missing` -> `"missing"`
 * - `missing-sections` -> `"differs"` with `missingSections` naming each absent
 *   section in contract order ("behind" is expressed as `differs`)
 * - `unreadable` / `malformed-frontmatter` / `malformed-body` -> `"malformed"`
 *   (a present-but-unreadable file is never reported as `"missing"`)
 *
 * The brain config is user-owned: the result never carries `canonicalContent`,
 * so nothing downstream can write it. Repair is routed to `/aide:brain config`.
 */
export default async function checkBrainConfig(projectRoot: string): Promise<UpgradeFileResult> {
	const base = {
		name: ".aide/config/brain.aide",
		filePath: join(projectRoot, ".aide", "config", "brain.aide"),
		category: "brain",
	} as const;

	const brain = await parseBrainAide(projectRoot);
	switch (brain.kind) {
		case "ok":
			return { ...base, status: "matches" };
		case "missing":
			return { ...base, status: "missing" };
		case "missing-sections":
			return { ...base, status: "differs", missingSections: brain.sections };
		case "unreadable":
		case "malformed-frontmatter":
		case "malformed-body":
			return { ...base, status: "malformed" };
	}
}
