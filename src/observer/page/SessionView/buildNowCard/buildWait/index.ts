import type { ObserverEvent, Status, WaitingFile } from "@/types/index.js";
import baseName from "@/util/baseName/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import moduleLabel from "@/observer/page/HomeView/buildHomeModel/moduleLabel/index.js";
import findWriter from "./findWriter/index.js";

/**
 * The amber card for an open gate: what the user is asked to approve (the file's base name), for
 * which module (the root module reads as the project's name), who wrote it when a phase reported
 * finishing it, and how long it has waited. It only tells the user to answer in the agent's session.
 */
export default function buildWait({
	status,
	events,
	waiting,
	now,
}: {
	status: Status;
	events: ObserverEvent[];
	waiting: WaitingFile;
	now: Date;
}): NowCardModel {
	const writer = findWriter({ projectRoot: status.projectRoot, events, waiting });
	return {
		kind: "wait",
		state: "Waiting on you",
		icon: "wait",
		title: "Approve",
		titleMono: baseName(waiting.file),
		sub: null,
		parts: [
			{ label: "for", value: moduleLabel({ folder: waiting.folder, projectName: baseName(status.projectRoot) }), mono: true },
			...(writer === null ? [] : [{ label: "written by", value: writer, mono: true }]),
		],
		time: formatAgo({ iso: waiting.since, now }),
		timeLabel: `waiting since ${formatClock({ iso: waiting.since, now }).clock}`,
		steps: null,
		hint: "The agent is paused until you answer in its session. This page is read-only.",
	};
}
