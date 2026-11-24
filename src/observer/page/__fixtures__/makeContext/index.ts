import type { ObserverEvent, Status } from "@/types/index.js";
import type { DrawerContext } from "@/observer/page/types/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";

/** A drawer context over a status (or none) and the held events. */
export default function makeContext({ status = makeStatus(), events = [] }: { status?: Status | null; events?: ObserverEvent[] } = {}): DrawerContext {
	return { token: "tok", projectKey: "proj", status, events, sessions: [], focus: "s1", now: NOW };
}
