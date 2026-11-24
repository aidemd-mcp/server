import protocol from "@/service/observer/event/shared/protocol/index.js";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/**
 * Binds the observer's HTTP server to the loopback interface on exactly the requested port.
 * `exclusive` keeps the socket out of any cluster sharing. It never retries and never tries
 * another port: a busy port is a failed start the caller reports, because the port is part of
 * the address the user was told.
 */
export default function bindServer({
	port,
	handler,
}: {
	port: number;
	handler: (req: IncomingMessage, res: ServerResponse) => void;
}): Promise<{ kind: "bound"; server: Server } | { kind: "failed"; reason: string }> {
	return new Promise((resolve) => {
		const server = createServer(handler);

		server.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EADDRINUSE") {
				resolve({
					kind: "failed",
					reason: `Port ${port} is busy; the observer did not start. Another program is using it.`,
				});
				return;
			}
			resolve({
				kind: "failed",
				reason: `Could not listen on ${protocol.bindHost}:${port} (${error.code ?? error.message}); the observer did not start.`,
			});
		});

		server.listen({ port, host: protocol.bindHost, exclusive: true }, () => {
			resolve({ kind: "bound", server });
		});
	});
}
