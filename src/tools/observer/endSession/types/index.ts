import type { EndSessionOutcome } from "@/types/index.js";

/**
 * What `formatReply` turns into the one reply line of `aide_observer_end_session`: the service's
 * outcome, or `failed`, the tool's own variant for a read or write failure inside the service.
 * The service never produces `failed`; the tool's catch does.
 */
export type EndSessionReply = EndSessionOutcome | { outcome: "failed"; detail: string };
