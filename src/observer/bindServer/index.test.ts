import { createServer as createNetServer, type AddressInfo, type Server as NetServer } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import bindServer from "./index.js";

const handler = (_req: unknown, res: { end: () => void }) => res.end();
const open: (Server | NetServer)[] = [];

async function freePort(): Promise<number> {
	const probe = createNetServer();
	await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
	const { port } = probe.address() as AddressInfo;
	await new Promise<void>((resolve) => probe.close(() => resolve()));
	return port;
}

afterEach(async () => {
	await Promise.all(open.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("bindServer", () => {
	it("binds the requested port on 127.0.0.1 and never another", async () => {
		const port = await freePort();
		const bound = await bindServer({ port, handler });
		expect(bound.kind).toBe("bound");
		if (bound.kind !== "bound") return;
		open.push(bound.server);
		expect(bound.server.address()).toMatchObject({ address: "127.0.0.1", port });
	});

	it("fails naming the port when something already holds it", async () => {
		const port = await freePort();
		const holder = createNetServer();
		await new Promise<void>((resolve) => holder.listen(port, "127.0.0.1", resolve));
		open.push(holder);

		const bound = await bindServer({ port, handler });
		expect(bound).toEqual({
			kind: "failed",
			reason: `Port ${port} is busy; the observer did not start. Another program is using it.`,
		});
	});
});
