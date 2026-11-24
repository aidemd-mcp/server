import { createServer } from "node:net";
import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * Tests whether `<protocol.bindHost>:<port>` can be bound right now. The probe server is
 * closed again before this resolves true, so the caller can bind the port
 * itself straight after. Any bind failure (EADDRINUSE, EACCES, ...) resolves
 * false; it never throws.
 */
export default function tryBind(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const probe = createServer();
		probe.once("error", () => resolve(false));
		probe.listen({ port, host: protocol.bindHost, exclusive: true }, () => {
			probe.close(() => resolve(true));
		});
	});
}
