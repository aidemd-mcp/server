import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/requestJson/index.js", () => ({ default: vi.fn() }));

import requestJson from "@/observer/page/api/requestJson/index.js";
import fetchSessions from "./index.js";

const request = requestJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("fetchSessions", () => {
	it("asks for the project's sessions path with the link's token", async () => {
		request.mockResolvedValue({ ok: true, data: { sessions: [] } });

		await fetchSessions({ token: "tok", projectKey: "my app-1a2b3c" });

		expect(request).toHaveBeenCalledWith({ path: "/api/projects/my%20app-1a2b3c/sessions", token: "tok" });
	});

	it("passes the result through untouched", async () => {
		const success = { ok: true, data: { sessions: [] } };
		request.mockResolvedValue(success);

		expect(await fetchSessions({ token: "tok", projectKey: "k" })).toBe(success);
	});
});
