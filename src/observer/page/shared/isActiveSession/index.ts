import type { SessionRowModel } from "@/observer/page/types/index.js";

/** The one "is this session still going" rule: live or idle, anything but ended. */
export default function isActiveSession({ liveness }: Pick<SessionRowModel, "liveness">): boolean {
	return liveness !== "ended";
}
