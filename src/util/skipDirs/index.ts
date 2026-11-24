/**
 * The folders every filesystem walk skips: dependency, build and VCS output.
 * Shared by `scan`, `classify` and `inspect`'s walk so they skip the same
 * folders. It holds only the list; how each caller skips stays with the caller.
 */
const SKIP_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".next",
	"coverage",
	"__pycache__",
] as const;

export default SKIP_DIRS;
