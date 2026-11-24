import type { ServerResponse } from "node:http";
import type { StreamHub } from "../types/index.js";
import frame from "./frame/index.js";

const STREAM_CLIENT_BUFFER_LIMIT = 1_048_576;
const STREAM_KEEPALIVE_MS = 15_000;
const STREAM_RETRY_MS = 2_000;

/**
 * Create the server-sent-event hub. Broadcasts are synchronous and never await a client:
 * a client buffering more than `bufferLimit` bytes is destroyed (its EventSource reconnects
 * and receives a fresh snapshot), so one stalled reader cannot delay or exhaust the others.
 * A client may subscribe for one project: a broadcast that names a project reaches the clients
 * with no filter and the clients filtered to that project; a broadcast naming none reaches all;
 * `unfilteredOnly` reaches only the clients with no filter (the home list is not a project frame).
 */
export default function createStreamHub({
	bufferLimit = STREAM_CLIENT_BUFFER_LIMIT,
	keepaliveMs = STREAM_KEEPALIVE_MS,
}: { bufferLimit?: number; keepaliveMs?: number } = {}): StreamHub {
	const clients = new Map<ServerResponse, string | undefined>();
	let keepalive: NodeJS.Timeout | null = null;

	function stopKeepalive(): void {
		if (keepalive === null) return;
		clearInterval(keepalive);
		keepalive = null;
	}

	function startKeepalive(): void {
		if (keepalive !== null) return;
		keepalive = setInterval(() => {
			for (const client of clients.keys()) client.write(": ping\n\n");
		}, keepaliveMs);
		keepalive.unref();
	}

	function unregister(res: ServerResponse): void {
		clients.delete(res);
		if (clients.size === 0) stopKeepalive();
	}

	return {
		subscribe({ res, snapshot, projectKey }) {
			res.writeHead(200, {
				"Content-Type": "text/event-stream; charset=utf-8",
				"Cache-Control": "no-store",
				Connection: "keep-alive",
				"X-Content-Type-Options": "nosniff",
			});
			res.write(`retry: ${STREAM_RETRY_MS}\n\n`);
			res.write(frame({ name: "snapshot", data: snapshot }));
			clients.set(res, projectKey);
			res.on("close", () => unregister(res));
			startKeepalive();
		},

		broadcast({ name, data, projectKey, unfilteredOnly = false }) {
			const message = frame({ name, data });
			for (const [client, filter] of [...clients]) {
				if (unfilteredOnly && filter !== undefined) continue;
				if (projectKey !== undefined && filter !== undefined && filter !== projectKey) continue;
				if (client.writableLength > bufferLimit) {
					unregister(client);
					client.destroy();
					continue;
				}
				client.write(message);
			}
		},

		closeAll() {
			const closing = [...clients.keys()];
			clients.clear();
			stopKeepalive();
			for (const client of closing) client.end();
		},

		size() {
			return clients.size;
		},
	};
}
