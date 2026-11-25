import { describe, it, expect, vi } from "vitest";

vi.mock("@/service/observer/event/endSession/index.js", () => ({
	default: vi.fn(),
}));

import endSessionService from "@/service/observer/event/endSession/index.js";
import endSession from "./index.js";

const input = { sessionId: "20261125T090000000Z-bbbbbb" };

describe("endSession tool failure", () => {
	it("answers not ended with the message instead of throwing", async () => {
		vi.mocked(endSessionService).mockRejectedValueOnce(new Error("disk gone"));
		expect(await endSession({ root: "/project", input })).toBe("not ended (disk gone)");
	});

	it("answers not ended with the value when the service rejects with a non-Error", async () => {
		vi.mocked(endSessionService).mockRejectedValueOnce("disk gone");
		expect(await endSession({ root: "/project", input })).toBe("not ended (disk gone)");
	});
});
