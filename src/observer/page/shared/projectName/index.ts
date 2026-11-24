import { HASH_SUFFIX } from "@/util/runtimePaths/shared/projectKeyHash/index.js";
import baseName from "@/util/baseName/index.js";

/**
 * The name a project is shown under: the last segment of its reported root, else the project key
 * without its `-<6 hex>` suffix.
 */
export default function projectName({
	projectRoot,
	projectKey,
}: {
	projectRoot: string | null | undefined;
	projectKey: string;
}): string {
	if (projectRoot) return baseName(projectRoot);
	return projectKey.replace(HASH_SUFFIX, "");
}
