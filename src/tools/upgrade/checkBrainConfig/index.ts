import { join } from "node:path";
import type { UpgradeFileResult } from "@/types/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import { readBrainMigrationNotice } from "@/service/install/provisionBrain/index.js";

/**
 * Reports whether the host's brain config is at the current contract. Parses
 * `.aide/config/brain.aide` through `parseBrainAide` and maps the parse result
 * onto the upgrade comparison vocabulary. Three kinds of drift are reported, each
 * under its own field so none is folded into another:
 *
 * - missing required sections -> `"differs"` with `missingSections` (contract order)
 * - existing sections whose text is a known outdated template -> `"differs"`
 *   with `staleSections`
 * - a legacy brain launcher -> `"differs"` with `legacyLauncher` (the reasons)
 *
 * Mapping:
 *
 * - `ok` -> `"matches"`, or `"differs"` when the migration notice reports stale
 *   sections or a legacy launcher
 * - `missing` -> `"missing"`
 * - `missing-sections` -> `"differs"` with `missingSections`, plus the stale and
 *   legacy fields when the migration notice reports them
 * - `unreadable` / `malformed-frontmatter` / `malformed-body` -> `"malformed"`
 *   (a present-but-unreadable file is never reported as `"missing"`)
 *
 * The migration notice is consulted only for `ok` and `missing-sections`; broken
 * files never reach it. Detection is read-only: the result never carries section
 * bytes, `canonicalContent` or a `prescription`. The brain category's writes
 * happen in `brainCategory` (missing-section insertion, change preview, guarded
 * apply), never here.
 */
export default async function checkBrainConfig(projectRoot: string): Promise<UpgradeFileResult> {
	const base = {
		name: ".aide/config/brain.aide",
		filePath: join(projectRoot, ".aide", "config", "brain.aide"),
		category: "brain",
	} as const;

	const brain = await parseBrainAide(projectRoot);
	switch (brain.kind) {
		case "ok": {
			const notice = await readBrainMigrationNotice(projectRoot);
			if (!notice) return { ...base, status: "matches" };
			return {
				...base,
				status: "differs",
				...(notice.staleSections.length > 0 && { staleSections: notice.staleSections }),
				...(notice.legacyLauncher !== null && { legacyLauncher: notice.legacyLauncher }),
			};
		}
		case "missing":
			return { ...base, status: "missing" };
		case "missing-sections": {
			const notice = await readBrainMigrationNotice(projectRoot);
			return {
				...base,
				status: "differs",
				missingSections: brain.sections,
				...(notice && notice.staleSections.length > 0 && { staleSections: notice.staleSections }),
				...(notice && notice.legacyLauncher !== null && { legacyLauncher: notice.legacyLauncher }),
			};
		}
		case "unreadable":
		case "malformed-frontmatter":
		case "malformed-body":
			return { ...base, status: "malformed" };
	}
}
