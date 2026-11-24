import protocol from "@/service/observer/event/shared/protocol/index.js";
import type { ApiResult, ConnectionState, StreamFrame, StreamSource } from "@/observer/page/types/index.js";
import fetchProjects from "@/observer/page/api/fetchProjects/index.js";
import fetchSessions from "@/observer/page/api/fetchSessions/index.js";

const FRAME_NAMES = ["snapshot", "aide-event", "status", "sessions", "projects"] as const;
const PROBE_INTERVAL_MS = 2000;

/**
 * Opens the observer's live stream and keeps it open. `EventSource` gives up for good on a non-200
 * answer, so this owns the retry: on an error it closes the source and probes a cheap JSON route:
 * 200 reopens the stream, 404 reports `not-found` and 401 `unauthorized` (both stop), anything
 * else reports `reconnecting` and keeps probing every 2 s. A stream that has never been live
 * (a first load) is probed at once and reports nothing until the probe answers, so a bad link
 * reaches `unauthorized` without a `reconnecting` banner or a 2 s wait first; a stream that was
 * live reports `reconnecting` straight away and probes after the delay. Frames are JSON-parsed and
 * handed to `onFrame`; `open` reports `live`. `close()` stops the source and any pending probe.
 */
export default function connectStream({
	token,
	projectKey,
	onFrame,
	onConnection,
	openSource = (url) => new EventSource(url),
	probe = () => (projectKey ? fetchSessions({ token, projectKey }) : fetchProjects({ token })),
}: {
	token: string;
	projectKey?: string;
	onFrame: (frame: StreamFrame) => void;
	onConnection: (state: ConnectionState) => void;
	openSource?: (url: string) => StreamSource;
	probe?: () => Promise<ApiResult<unknown>>;
}): { close(): void } {
	const url = `/api/stream?${projectKey ? `project=${encodeURIComponent(projectKey)}&` : ""}${protocol.tokenQuery}=${encodeURIComponent(token)}`;
	let source: StreamSource | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;
	let hasBeenLive = false;
	let firstLoadProbed = false;

	const open = (): void => {
		const opened = openSource(url);
		source = opened;
		for (const name of FRAME_NAMES) {
			opened.addEventListener(name, (event) => {
				try {
					onFrame({ name, data: JSON.parse(event.data) } as StreamFrame);
				} catch (error) {
					console.error(`The observer sent an unreadable ${name} frame.`, error);
				}
			});
		}
		opened.onopen = () => {
			if (source !== opened) return;
			hasBeenLive = true;
			onConnection("live");
		};
		opened.onerror = () => {
			if (source !== opened) return;
			opened.close();
			source = null;
			if (!hasBeenLive && !firstLoadProbed) {
				firstLoadProbed = true;
				void runProbe({ announceDown: true });
				return;
			}
			onConnection("reconnecting");
			schedule();
		};
	};

	const runProbe = async ({ announceDown }: { announceDown: boolean }): Promise<void> => {
		timer = null;
		const result = await probe();
		if (closed) return;
		if (result.ok) open();
		else if (result.status === 404) onConnection("not-found");
		else if (result.status === 401) onConnection("unauthorized");
		else {
			if (announceDown) onConnection("reconnecting");
			schedule();
		}
	};

	const schedule = (): void => {
		timer = setTimeout(() => void runProbe({ announceDown: false }), PROBE_INTERVAL_MS);
	};

	open();

	return {
		close() {
			closed = true;
			if (timer !== null) clearTimeout(timer);
			timer = null;
			source?.close();
			source = null;
		},
	};
}
