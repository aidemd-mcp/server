import { z } from "zod";
import buildViewLink from "@/observer/buildViewLink/index.js";
import resolvePort from "@/observer/resolvePort/index.js";
import takeOver from "@/observer/takeOver/index.js";
import type { RunningObserver } from "@/observer/types/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import readPackageVersion from "@/util/readPackageVersion/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import tryBind from "@/tools/observer/shared/tryBind/index.js";
import describeError from "@/util/describeError/index.js";
import type { StartReply } from "./types/index.js";
import launchObserver from "./launchObserver/index.js";
import awaitObserver from "./awaitObserver/index.js";

/** The tool takes no input; an extra key such as an old `port` is ignored, not rejected. */
export const ObserverStartInput = z.object({});

/**
 * Starts the one per-user observer, or reports the one already running, and always answers with
 * the link to the calling session's view (brief commitments #1, #26, #34, #37, #39). The port
 * comes from the shared precedence (`AIDE_OBSERVER_PORT`, else the default), an invalid value is
 * refused by name. A same-or-newer running observer is kept, an older one is replaced before
 * anything is spawned, and one that will not exit is reported stuck with both versions. A busy
 * port is named and nothing is spawned (never another port). Never throws: any failure becomes a
 * not-started reply.
 */
export default async function start({
	root,
	entryScript,
}: {
	root: string;
	entryScript: string;
}): Promise<StartReply> {
	try {
		const choice = resolvePort({});
		if (!choice.ok) return { outcome: "not-started", reason: choice.reason };
		const { port } = choice;

		// The calling session's view: this project's key and this process's session id.
		const linkTo = (observer: RunningObserver) =>
			buildViewLink({
				observer,
				view: { projectKey: resolve({ projectRoot: root }).projectKey, sessionId: getSession().sessionId },
			});

		// Single instance: a running observer of any project is kept, an older one is replaced.
		const ownVersion = readPackageVersion();
		const taken = await takeOver({ version: ownVersion });
		if (taken.outcome === "kept") return { outcome: "running", link: linkTo(taken.observer) };
		if (taken.outcome === "stuck") {
			return {
				outcome: "stuck",
				runningVersion: taken.observer.version,
				ownVersion,
				link: linkTo(taken.observer),
			};
		}

		// The port must be bindable; never fall back to another one.
		if (!(await tryBind(port))) return { outcome: "not-started", reason: `port ${port} is busy` };

		// Spawn the package's own entry detached, then wait until it answers.
		const child = launchObserver({ root, port, entryScript });
		const awaited = await awaitObserver({ port, child });
		if (awaited.outcome === "not-started") return awaited;

		const link = linkTo(awaited.observer);
		return taken.outcome === "replaced"
			? { outcome: "started", link, replaced: taken.previous.version }
			: { outcome: "started", link };
	} catch (error) {
		return {
			outcome: "not-started",
			reason: describeError({ error }),
		};
	}
}
