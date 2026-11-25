import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRecord } = vi.hoisted(() => ({ mockRecord: vi.fn() }));

vi.mock("@/service/observer/event/record/index.js", () => ({ default: mockRecord }));

import event from "./index.js";

describe("event", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("passes the input through untouched with projectRoot set to root", async () => {
		mockRecord.mockResolvedValue({ logged: "written", delivered: true });
		const input = { kind: "release", version: "1.2.3", extra: "kept as is" };

		await event({ root: "/project", input });

		expect(mockRecord).toHaveBeenCalledTimes(1);
		expect(mockRecord).toHaveBeenCalledWith({ projectRoot: "/project", input });
		expect(mockRecord.mock.calls[0][0].input).toBe(input);
	});

	it("replies with formatReply's line for the outcome", async () => {
		mockRecord.mockResolvedValue({ logged: "written", delivered: false, sessionId: "2026-11-25T10-00-00Z-ab12" });

		const reply = await event({ root: "/project", input: {} });

		expect(reply).toBe("recorded; observer not running [observer-session 2026-11-25T10-00-00Z-ab12]");
	});
});
