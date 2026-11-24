import type { Server } from "node:http";
import removeRecord from "../removeRecord/index.js";
import type { StreamHub } from "../types/index.js";

/**
 * Builds the observer's `stop`, its `stopped` signal and `attach`. The stop exists before the server
 * does (the context holding it is built before the bind); `attach(server)` hands it the bound server
 * and a `stop()` before that has no server to close. The first `stop()` closes the stream
 * clients and the server, then removes `observer.json` if it still names this pid and token; later
 * calls return the same promise. `stopped` resolves when that first stop finishes, however it was
 * triggered (the caller's `stop()` or the shutdown request), so a waiting caller learns the
 * observer is gone. It installs no signal handler and never calls `process.exit`: the `view`
 * command owns SIGINT and SIGTERM and calls `stop()`, and with everything closed the process ends
 * by itself.
 */
export default function createStop({
	hub,
	observerFile,
	pid,
	token,
}: {
	hub: StreamHub;
	observerFile: string;
	pid: number;
	token: string;
}): { stop: () => Promise<void>; stopped: Promise<void>; attach: (server: Server) => void } {
	let attached: Server | null = null;
	let stopping: Promise<void> | null = null;
	let markStopped: () => void = () => undefined;
	const stopped = new Promise<void>((resolve) => {
		markStopped = resolve;
	});

	const stop = () => {
		stopping ??= (async () => {
			hub.closeAll();
			if (attached !== null) {
				const server = attached;
				const closed = new Promise<void>((resolve) => server.close(() => resolve()));
				server.closeAllConnections();
				await closed;
			}
			await removeRecord({ observerFile, pid, token });
		})().finally(markStopped);
		return stopping;
	};

	return {
		stop,
		stopped,
		attach: (server) => {
			attached = server;
		},
	};
}
