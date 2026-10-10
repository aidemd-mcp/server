import { join, isAbsolute } from "node:path";

/**
 * The one project-root resolver for aide_upgrade: an absolute `path` wins, a
 * relative `path` is joined onto the server `root`, and an absent `path` means
 * `root` itself. Shared by detection (`upgrade`) and the brain category so both
 * address the same project.
 */
export default function resolveProjectRoot(root: string, path?: string): string {
	if (!path) return root;
	return isAbsolute(path) ? path : join(root, path);
}
