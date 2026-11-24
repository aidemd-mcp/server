import record from "@/service/observer/event/record/index.js";
import formatReply from "@/tools/observer/event/formatReply/index.js";

/**
 * Records one pipeline event and returns the one reply line. It validates
 * nothing itself: the recorder validates with the shared schema, so there is
 * one schema in one place. Never throws, because `record` never throws.
 */
export default async function event({ root, input }: { root: string; input: unknown }): Promise<string> {
	const outcome = await record({ projectRoot: root, input });
	return formatReply(outcome);
}
