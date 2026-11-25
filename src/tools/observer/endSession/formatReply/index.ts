import type { EndSessionReply } from "@/tools/observer/endSession/types/index.js";

/**
 * Turns an end-session reply into the one line of `aide_observer_end_session` (brief commitment
 * #97): `ended <id>`, `already ended <id>`, `refused: <id> is this session`,
 * `refused: no session <id> in this project`, `refused: invalid session id`, and
 * `not ended (<detail>)` for a failure inside the service. The wording is exact; the agent relays
 * it to the user.
 */
export default function formatReply(reply: EndSessionReply): string {
	switch (reply.outcome) {
		case "ended":
			return `ended ${reply.id}`;
		case "already-ended":
			return `already ended ${reply.id}`;
		case "own-session":
			return `refused: ${reply.id} is this session`;
		case "unknown":
			return `refused: no session ${reply.id} in this project`;
		case "invalid-id":
			return "refused: invalid session id";
		case "failed":
			return `not ended (${reply.detail})`;
	}
}
