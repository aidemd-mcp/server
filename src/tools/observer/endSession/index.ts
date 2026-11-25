import { z } from "zod";
import endSessionService from "@/service/observer/event/endSession/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import formatReply from "@/tools/observer/endSession/formatReply/index.js";
import describeError from "@/util/describeError/index.js";

/**
 * The tool's input: one session id, an observer session id or a Claude session id of this
 * project. Strict, so a stray key is refused instead of silently ignored.
 */
export const EndSessionInput = z.object({ sessionId: z.string().min(1) }).strict();

/**
 * Ends another session of the project on the user's approval: writes its ended mark and deletes
 * nothing. An input that fails the schema answers `refused: invalid session id`; a filesystem
 * failure inside the service answers `not ended (<message>)`. Never throws.
 */
export default async function endSession({ root, input }: { root: string; input: unknown }): Promise<string> {
	const { data, error } = EndSessionInput.safeParse(input);
	if (error) return formatReply({ outcome: "invalid-id", detail: error.message });

	try {
		const outcome = await endSessionService({
			projectRoot: root,
			id: data.sessionId,
			bySessionId: getSession().sessionId,
		});
		return formatReply(outcome);
	} catch (failure) {
		return formatReply({ outcome: "failed", detail: describeError({ error: failure }) });
	}
}
