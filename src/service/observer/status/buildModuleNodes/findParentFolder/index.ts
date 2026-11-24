/**
 * The nearest ancestor node folder of `folder` among `folders`: the longest
 * entry (other than `folder` itself) that is `"."` or a proper `/`-bounded
 * prefix of `folder`. The root `"."` has no parent. Pure.
 */
export default function findParentFolder({ folder, folders }: { folder: string; folders: string[] }): string | null {
	if (folder === ".") return null;

	let parent: string | null = null;
	for (const candidate of folders) {
		if (candidate === folder) continue;
		const isAncestor = candidate === "." || folder.startsWith(`${candidate}/`);
		if (!isAncestor) continue;
		if (parent === null || candidate.length > parent.length) parent = candidate;
	}
	return parent;
}
