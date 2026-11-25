import type { SessionRowModel } from "@/observer/page/types/index.js";

/** The one "is this session still going" rule: anything but ended, quiet or not. */
export default function isActiveSession({ liveness }: Pick<SessionRowModel, "liveness">): boolean {
	return liveness.state !== "ended";
}
