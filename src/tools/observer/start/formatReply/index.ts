import buildObserverMessage from "@/observer/shared/buildObserverMessage/index.js";
import type { StartReply } from "../types/index.js";

/**
 * Turns a start reply into the one line the /aide skill branches on (brief commitment #37),
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
		case "not-started":
			return buildObserverMessage({ kind: "not-started", reason: reply.reason });
	}
}
