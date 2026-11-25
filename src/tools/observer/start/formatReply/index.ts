import buildObserverMessage from "@/observer/shared/buildObserverMessage/index.js";
import type { StartReply } from "../types/index.js";
import describeOpenSession from "./describeOpenSession/index.js";

/**
 * Turns a start reply into the one line the /aide skill branches on (brief commitments #37, #69, #97),
 * using the shared observer message builder so the `view` command prints the same texts.
 */
export default function formatReply(reply: StartReply): string {
	switch (reply.outcome) {
		case "started":
			return buildObserverMessage({
				kind: "started",
				link: reply.link,
				...(reply.replaced !== undefined && { note: `replaced the older observer, version ${reply.replaced}` }),
			});
		case "running":
			return buildObserverMessage({ kind: "already-running", link: reply.link });
		case "stuck":
			return buildObserverMessage({ ...reply, kind: "stuck" });
		case "halt":
			return [
				"HALT: another session of this project is open. Nothing proceeds until the user approves ending it with aide_observer_end_session, or closes this session.",
				...reply.open.map(describeOpenSession),
				`Observer: ${reply.link}`,
			].join("\n");
		case "blocked":
			return `BLOCKED: the observer could not start, so nothing proceeds. ${reply.reason}`;
	}
}
