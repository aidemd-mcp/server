/**
 * AIDE's hook command for this machine: a direct `node` call on the globally
 * installed entry point. `entry` is already absolute with forward slashes
 * (`locateEntry` guarantees it), so double quotes are enough to survive a path
 * with spaces in every shell. No event argument: the hook reads the event from stdin.
 */
export default function buildCommand(entry: string): string {
	return `node "${entry}" hook`;
}
