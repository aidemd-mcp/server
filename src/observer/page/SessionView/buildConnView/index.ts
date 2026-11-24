import type { ConnectionState, ConnState, SessionRowModel } from "@/observer/page/types/index.js";

/**
 * The header pill's state: `recon` while the stream is down, whatever the sessions say; else `live`
 * when the session the view follows is live, and `idle` for any other state of it (idle, ended, or
 * a session the stream holds no row for), so the pill never claims more than the observer reported.
 */
export default function buildConnView({
	connection,
	session,
}: {
	connection: ConnectionState;
	session: Pick<SessionRowModel, "liveness"> | null;
}): ConnState {
	if (connection === "reconnecting") return "recon";
	return session?.liveness === "live" ? "live" : "idle";
}
