import type { ConnectionState, ConnState, SessionRowModel } from "@/observer/page/types/index.js";

/**
 * The header pill's state: `recon` while the stream is down, whatever the sessions say; else `live`
 * when the session the view follows is working or waiting and not quiet long enough to be maybe
 * stuck, and `idle` for any other state of it (maybe stuck, ended, or a session the stream holds no row for), so the pill never claims more than the observer reported.
 */
export default function buildConnView({
	connection,
	session,
}: {
	connection: ConnectionState;
	session: Pick<SessionRowModel, "liveness"> | null;
}): ConnState {
	if (connection === "reconnecting") return "recon";
	return session !== null && session.liveness.state !== "ended" && !session.liveness.maybeStuck ? "live" : "idle";
}
