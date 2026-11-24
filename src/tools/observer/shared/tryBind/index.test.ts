import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import tryBind from "./index.js";

const open: Server[] = [];

/** Binds a server on an OS-assigned loopback port and returns it with its port. */
function listenOnFreePort(): Promise<{ server: Server; port: number }> {
	return new Promise((resolve) => {
		const server = createServer();
		open.push(server);
		server.listen({ port: 0, host: "127.0.0.1" }, () => {
			resolve({ server, port: (server.address() as { port: number }).port });
		});
	});
}

/** Closes a server and waits for the port to be released. */
function closeServer(server: Server): Promise<void> {
	return new Promise((resolve) => {
		if (!server.listening) return resolve();
		server.close(() => resolve());
	});
}

afterEach(async () => {
	for (const server of open.splice(0)) await closeServer(server);
});

describe("tryBind", () => {
	it("returns true for a free port", async () => {
		const { server, port } = await listenOnFreePort();
		await closeServer(server);

		expect(await tryBind(port)).toBe(true);
	});

	it("returns false for a port held by another server", async () => {
		const { port } = await listenOnFreePort();

		expect(await tryBind(port)).toBe(false);
	});

	it("leaves the port free again right after a true result", async () => {
		const { server, port } = await listenOnFreePort();
		await closeServer(server);

		expect(await tryBind(port)).toBe(true);
		expect(await tryBind(port)).toBe(true);
	});
});
