import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../removeRecord/index.js", () => ({ default: vi.fn().mockResolvedValue(undefined) }));

import removeRecord from "../removeRecord/index.js";
import type { StreamHub } from "../types/index.js";
import createStop from "./index.js";

const mockRemoveRecord = removeRecord as ReturnType<typeof vi.fn>;
let server: Server;

function makeHub(): StreamHub {
	return { subscribe: vi.fn(), broadcast: vi.fn(), closeAll: vi.fn(), size: vi.fn().mockReturnValue(0) };
}

beforeEach(async () => {
	vi.clearAllMocks();
	server = createServer((_req, res) => res.end());
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

afterEach(async () => {
	if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("createStop", () => {
	it("closes the hub and the server and removes the record for this pid and token", async () => {
		const hub = makeHub();
		const { stop, attach } = createStop({ hub, observerFile: "/x/observer.json", pid: 7, token: "t" });
		attach(server);
		await stop();
		expect(hub.closeAll).toHaveBeenCalledTimes(1);
		expect(server.listening).toBe(false);
		expect(mockRemoveRecord).toHaveBeenCalledWith({ observerFile: "/x/observer.json", pid: 7, token: "t" });
	});

	it("is safe to call twice and does the work once", async () => {
		const hub = makeHub();
		const { stop, attach } = createStop({ hub, observerFile: "/x/observer.json", pid: 7, token: "t" });
		attach(server);
		const first = stop();
		const second = stop();
		expect(second).toBe(first);
		await first;
		await stop();
		expect(hub.closeAll).toHaveBeenCalledTimes(1);
		expect(mockRemoveRecord).toHaveBeenCalledTimes(1);
	});

	it("resolves stopped once the first stop finishes, whoever triggered it", async () => {
		const { stop, stopped, attach } = createStop({ hub: makeHub(), observerFile: "/x/observer.json", pid: 7, token: "t" });
		attach(server);
		let settled = false;
		void stopped.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		await stop();
		await stopped;
		expect(settled).toBe(true);
		expect(mockRemoveRecord).toHaveBeenCalledTimes(1);
	});

	it("stops without a server when none was attached, and still removes the record", async () => {
		const hub = makeHub();
		const { stop } = createStop({ hub, observerFile: "/x/observer.json", pid: 7, token: "t" });
		await stop();
		expect(hub.closeAll).toHaveBeenCalledTimes(1);
		expect(server.listening).toBe(true);
		expect(mockRemoveRecord).toHaveBeenCalledWith({ observerFile: "/x/observer.json", pid: 7, token: "t" });
	});

	it("installs no SIGINT or SIGTERM handler, before or after stop", async () => {
		const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
		const { stop, attach } = createStop({ hub: makeHub(), observerFile: "/x/observer.json", pid: 7, token: "t" });
		attach(server);
		expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
		await stop();
		expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
	});
});
