/**
 * The one process-alive check every module uses: the event log's session
 * liveness, the stale `observer.json` check and the status view's three-state
 * liveness all answer through it, so the page and the delete control can never
 * disagree (src/service/observer/brief.aide commitment #28).
 * Answers only "is this pid running"; what "live" means stays with the caller.
 * Sends signal 0 (an existence probe, never a real signal), writes nothing and
 * never throws.
 */
export default function isProcessRunning(pid: number): boolean {
	// pid 0 and negatives would address a process group, so never probe them.
	if (!Number.isSafeInteger(pid) || pid < 1) return false;

	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// EPERM: the process exists but belongs to another user.
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}
