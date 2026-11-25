import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTryBind } = vi.hoisted(() => ({ mockTryBind: vi.fn() }));

vi.mock("@/tools/observer/shared/tryBind/index.js", () => ({ default: mockTryBind }));

import protocol from "@/service/observer/event/shared/protocol/index.js";
import walkPorts from "./index.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("walkPorts", () => {
	it("returns the preferred port when it binds, probing nothing else", async () => {
		mockTryBind.mockResolvedValue({ ok: true });

		const result = await walkPorts({ preferred: protocol.ports[0] });

		expect(result).toEqual({ kind: "free", port: protocol.ports[0] });
		expect(mockTryBind).toHaveBeenCalledTimes(1);
	});

	it("walks on to the next listed port when the first is busy", async () => {
		mockTryBind.mockResolvedValueOnce({ ok: false, reason: "in use" }).mockResolvedValue({ ok: true });

		const result = await walkPorts({ preferred: protocol.ports[0] });

		expect(result).toEqual({ kind: "free", port: protocol.ports[1] });
	});

	it("tries a preferred port outside the list first", async () => {
		mockTryBind.mockResolvedValue({ ok: true });

		const result = await walkPorts({ preferred: 31000 });

		expect(result).toEqual({ kind: "free", port: 31000 });
		expect(mockTryBind).toHaveBeenNthCalledWith(1, 31000);
	});

	it("names every port with its reason, in order, when none binds", async () => {
		mockTryBind.mockImplementation(async (port: number) =>
			port === protocol.ports[1] ? { ok: false, reason: "not allowed" } : { ok: false, reason: "in use" },
		);

		const result = await walkPorts({ preferred: protocol.ports[0] });

		expect(result).toEqual({
			kind: "exhausted",
			tried: protocol.ports.map((port) => ({
				port,
				reason: port === protocol.ports[1] ? "not allowed" : "in use",
			})),
		});
	});
});
