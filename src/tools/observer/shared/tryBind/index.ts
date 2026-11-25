import { createServer } from "node:net";
import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * Tests whether `<protocol.bindHost>:<port>` can be bound right now. The probe server is
 * closed again before this resolves ok, so the caller can bind the port itself straight after.
 * A bind failure resolves `{ ok: false, reason }` with `in use` for EADDRINUSE, `not allowed`
 * for EACCES and the error code otherwise (the message when the error has no code); it never
 * throws.
 */
export default function tryBind(port: number): Promise<{ ok: true } | { ok: false; reason: string }> {
	return new Promise((resolve) => {
		const probe = createServer();
		probe.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EADDRINUSE") return resolve({ ok: false, reason: "in use" });
			if (error.code === "EACCES") return resolve({ ok: false, reason: "not allowed" });
			resolve({ ok: false, reason: error.code ?? error.message });
		});
		try {
			probe.listen({ port, host: protocol.bindHost, exclusive: true }, () => {
				probe.close(() => resolve({ ok: true }));
			});
		} catch (error) {
			// listen throws synchronously for an out-of-range port instead of emitting an error event.
			const { code, message } = error as NodeJS.ErrnoException;
			resolve({ ok: false, reason: code ?? message });
		}
	});
}
