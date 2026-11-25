import type { Server } from "node:http";
import protocol from "@/service/observer/event/shared/protocol/index.js";
import readPackageVersion from "@/util/readPackageVersion/index.js";
import createRoot from "@/util/runtimePaths/createRoot/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import resolveRoot from "@/util/runtimePaths/resolveRoot/index.js";
import bindServer from "./bindServer/index.js";
import createEventStore from "./createEventStore/index.js";
import buildProjectView from "./buildProjectView/index.js";
import createStatusPusher from "./createStatusPusher/index.js";
import createStop from "./createStop/index.js";
import createStreamHub from "./createStreamHub/index.js";
import handleRequest from "./handleRequest/index.js";
import listPorts from "./listPorts/index.js";
import loadToken from "./loadToken/index.js";
import parsePort from "./shared/parsePort/index.js";
import replaySessions from "./replaySessions/index.js";
import takeOver from "./takeOver/index.js";
import type { ObserverContext, StartResult } from "./types/index.js";
import writeRecord from "./writeRecord/index.js";

/**
 * Starts the one per-user observer, or reports the one that already runs. The order is the contract:
 * a port outside 1-65535 throws (caller bug); `takeOver` then decides about a running observer
 * (kept and stuck are returned as they are, nothing is bound; none and replaced continue); the
 * app-data root is created, the token loaded (created once per user, reused by every later start) and the store, hub, status pusher and context built;
 * the first free port of `listPorts` is bound, `port` being preferred and a replaced observer's port
 * preferred over it (none free: `not-started` naming every port tried, no record written); the
 * record, which names the bound port, is published while posts are held; and only then is every project's history replayed, merged with the
 * held posts and opened to reads and the stream. The record is published before the replay because
 * an event recorded mid-replay either sits in a file the replay reads or arrives as a post; the
 * `(sessionId, seq)` dedupe keeps one copy of it. `brainOverride` scopes the `--brain` path to the
 * project of the folder the view command ran from. Installs no signal handler and never calls
 * `process.exit`; the caller owns the process lifecycle and calls `stop()`.
 */
export default async function startObserver({
	port,
	brainOverride,
}: {
	/** The preferred port: the first one tried; the rest of the list follows when it is busy. */
	port: number;
	brainOverride?: { projectRoot: string; brainPath: string };
}): Promise<StartResult> {
	// 1. A port outside 1-65535 is a caller bug, not a start failure.
	const checked = parsePort({ value: String(port), source: "Observer port", shown: String(port) });
	if (!checked.ok) throw new Error(checked.reason);

	// 2. Single instance: a running observer from any project is kept, an older one is replaced.
	const version = readPackageVersion();
	const taken = await takeOver({ version });
	if (taken.outcome === "kept") return { outcome: "kept", observer: taken.observer };
	if (taken.outcome === "stuck") return { outcome: "stuck", observer: taken.observer };

	// 3. Locate the per-user app-data root and its observer.json.
	const { root, observerFile } = resolveRoot();

	// 4. Create the app-data root (outside every project).
	await createRoot();

	// 5. Load the one per-user token every request must carry (created on the first start, reused after).
	const token = await loadToken({ root });

	// 6. Build the store (holds posts until the replay ends), the hub, the status pusher and the context.
	const store = createEventStore();
	const hub = createStreamHub();
	// The stop is built before the server binds; it is handed the server once bound.
	const { stop, stopped, attach } = createStop({ hub, observerFile, pid: process.pid, token });
	// `port` is the preferred port until step 7 binds one; requests only arrive after that.
	const ctx: ObserverContext = {
		port,
		token,
		version,
		...(brainOverride !== undefined && {
			brainOverride: {
				projectKey: resolve({ projectRoot: brainOverride.projectRoot }).projectKey,
				brainPath: brainOverride.brainPath,
			},
		}),
		store,
		hub,
		statusPusher: createStatusPusher({ rebuild: (key) => buildProjectView({ ctx, projectKey: key }), hub }),
		shutdown: () => void stop(),
		now: () => Date.now(),
	};

	// 7. Walk the port list, the replaced observer's port first (brief #83), and bind the first free
	// one; no free port writes no observer.json. The per-user runtime root created in step 4 may
	// remain: it lives outside every project and the next start reuses it.
	const preferred = taken.outcome === "replaced" ? taken.previous.port : port;
	const handler = handleRequest({ ctx });
	const failures: string[] = [];
	let bound: { server: Server; port: number } | null = null;
	for (const candidate of listPorts({ preferred })) {
		const attempt = await bindServer({ port: candidate, handler });
		if (attempt.kind === "bound") {
			bound = { server: attempt.server, port: candidate };
			break;
		}
		failures.push(`${candidate} (${attempt.reason})`);
	}
	if (bound === null) return { outcome: "not-started", reason: `No port could be bound: ${failures.join(", ")}` };
	const { server } = bound;
	ctx.port = bound.port;
	// Attached from the bind on, so a shutdown request that lands during the replay works.
	attach(server);

	// 8. Publish observer.json so posters find the observer while history replays.
	const address = `http://${protocol.bindHost}:${bound.port}`;
	try {
		await writeRecord({ observerFile, record: { address, port: bound.port, token, pid: process.pid, version: ctx.version } });
	} catch (error) {
		await new Promise<void>((done) => {
			server.close(() => done());
			server.closeAllConnections();
		});
		throw error;
	}

	// 9. Replay history, then merge it with the held posts and open reads and the stream in one turn.
	const sessions = await replaySessions();
	store.finishReplay(sessions);

	// 10. Hand the caller the stop that closes everything and removes the record, and the signal
	// that it finished (also when the shutdown request triggered it).
	return { outcome: "started", observer: { address, port: bound.port, token, pid: process.pid, version }, stop, stopped };
}
