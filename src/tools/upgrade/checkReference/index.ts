import { join, posix } from "node:path";
import type { UpgradeFileResult } from "@/types/index.js";
import { listReferencePages, readCanonicalDoc } from "@/service/install/initContent/index.js";
import compareFile from "../compareFile/index.js";

/**
 * Read-only drift check for the tool and hook reference. Returns one result per
 * reference page, named by its path (e.g. `.aide/reference/hooks/SessionEnd.md`),
 * as a category of its own apart from `methodology-docs`. The page roster comes
 * from initContent; the host folder is `reference` beside the doc hub, the same
 * rule install uses, so what init plans is exactly what upgrade compares.
 */
export default async function checkReference({
	projectRoot,
	docHubDir,
}: {
	projectRoot: string;
	docHubDir: string;
}): Promise<UpgradeFileResult[]> {
	const displayPrefix = `${posix.dirname(docHubDir)}/reference`;
	const referenceDir = join(projectRoot, displayPrefix);

	const results: UpgradeFileResult[] = [];
	for (const entry of listReferencePages()) {
		const filePath = join(referenceDir, entry.hostPath);
		const canonical = readCanonicalDoc(entry.canonical);
		const status = await compareFile(filePath, canonical);
		results.push({
			name: `${displayPrefix}/${entry.hostPath}`,
			filePath,
			status,
			category: "reference",
			...(status !== "matches" ? { canonicalContent: canonical } : {}),
		});
	}
	return results;
}
