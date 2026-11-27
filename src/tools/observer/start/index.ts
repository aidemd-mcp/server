import { z } from "zod";
import buildViewLink from "@/observer/buildViewLink/index.js";
import resolvePort from "@/observer/resolvePort/index.js";
import takeOver from "@/observer/takeOver/index.js";
import type { RunningObserver } from "@/observer/types/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import readPackageVersion from "@/util/readPackageVersion/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import describeError from "@/util/describeError/index.js";
import type { LinkReply, StartReply } from "./types/index.js";
import walkPorts from "./walkPorts/index.js";
import checkProject from "./checkProject/index.js";
import launchObserver from "./launchObserver/index.js";
import moveLegacyHistory from "./moveLegacyHistory/index.js";
import awaitObserver from "./awaitObserver/index.js";

/** The tool takes no input; an extra key such as an old `port` is ignored, not rejected. */
export const ObserverStartInput = z.object({});

/**
 * Starts the one per-user observer, or reports the one already running, and always answers with
 * the link to the calling session's view (brief commitments #1, #26, #34, #37, #39, #73, #83).
 * The preferred port comes from the shared precedence (`AIDE_OBSERVER_PORT`, else the head of the
 * port list), an invalid value is blocked by name; after a replace the old observer's port is
 * preferred instead. A same-or-newer running observer is kept and an older one that will not exit
 * is reported stuck with both versions, both without any port walk. Otherwise the port list is
 * pre-walked with `tryBind` and the observer is spawned on the first bindable port; when none
 * binds the reply is blocked, naming every port and why. Once the observer answers (started,
 * running or stuck) `checkProject` runs (brief commitments #69, #82, #91, #125): the project's
 * other conversations closed without a report are marked, then the reply is a hard stop
 * (`stopped`: this session was ended on the user's approval, or a newer session has worked the
 * project since), a halt (another conversation is open; it still carries the link), a reopen
 * (`reopened`, or `reopen-failed` when the ended marks cannot be cleared) or the link reply
 * unchanged. Never throws: any failure, a failed start check included, becomes a blocked reply,
 * because nothing may proceed unobserved. The start first
 * carries the caller's old-folder history into the per-user root (brief commitment #107), best
 * effort: it never blocks and never changes the reply.
 */
export default async function start({
	root,
	entryScript,
}: {
	root: string;
	entryScript: string;
}): Promise<StartReply> {
	try {
		await moveLegacyHistory();
		const choice = resolvePort({});
		if (!choice.ok) return { outcome: "blocked", reason: choice.reason };

		// The calling session's view: this project's key and this process's session id.
		const linkTo = (observer: RunningObserver) =>
			buildViewLink({
				observer,
				view: { projectKey, sessionId },
			});

		// The start check (checkProject) runs once the observer answers.
		const projectKey = resolve({ projectRoot: root }).projectKey;
		const sessionId = getSession().sessionId;
		const checkHalt = (reply: LinkReply): Promise<StartReply> => checkProject({ projectRoot: root, sessionId, reply });

		// Single instance: a running observer of any project is kept, an older one is replaced.
		const ownVersion = readPackageVersion();
		const taken = await takeOver({ version: ownVersion });
		if (taken.outcome === "kept") return await checkHalt({ outcome: "running", link: linkTo(taken.observer) });
		if (taken.outcome === "stuck") {
			return await checkHalt({
				outcome: "stuck",
				runningVersion: taken.observer.version,
				ownVersion,
				link: linkTo(taken.observer),
			});
		}

		// Walk the port list: a replaced observer's port first, else the resolved one.
		const preferred = taken.outcome === "replaced" ? taken.previous.port : choice.port;
		const walked = await walkPorts({ preferred });
		if (walked.kind === "exhausted") {
			const named = walked.tried.map(({ port, reason }) => `${port} (${reason})`).join(", ");
			return { outcome: "blocked", reason: `No port could be bound: ${named}` };
		}
		const { port } = walked;

		// Spawn the package's own entry detached, then wait until it answers.
		const child = launchObserver({ root, port, entryScript });
		const awaited = await awaitObserver({ port, child });
		if (awaited.outcome === "not-started") return { outcome: "blocked", reason: awaited.reason };

		const link = linkTo(awaited.observer);
		return await checkHalt(
			taken.outcome === "replaced"
				? { outcome: "started", link, replaced: taken.previous.version }
				: { outcome: "started", link },
		);
	} catch (error) {
		return {
			outcome: "blocked",
			reason: describeError({ error }),
		};
	}
}
