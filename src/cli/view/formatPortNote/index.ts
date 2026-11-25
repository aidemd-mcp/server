/**
 * The line `view` prints when the observer is not on the port it was asked for. One wording for
 * every cause (busy, not allowed, a replaced observer's port preferred, an observer already
 * running elsewhere), because `view` is told the bound port, not why earlier ports were skipped.
 * Null when the observer is on the requested port, so there is nothing to say.
 */
export default function formatPortNote({ requested, actual }: { requested: number; actual: number }): string | null {
	if (requested === actual) return null;
	return `Port ${requested} was not used; the observer is on port ${actual}.`;
}
