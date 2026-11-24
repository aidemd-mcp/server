import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/requestJson/index.js", () => ({ default: vi.fn() }));

import requestJson from "@/observer/page/api/requestJson/index.js";
import fetchStatus from "./index.js";

const request = requestJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("fetchStatus", () => {
	it("asks for the project's status path with the link's token", async () => {
		request.mockResolvedValue({ ok: true, data: { state: "no-project-root" } });

		await fetchStatus({ token: "tok", projectKey: "my app-1a2b3c" });

		expect(request).toHaveBeenCalledWith({ path: "/api/projects/my%20app-1a2b3c/status", token: "tok" });
	});

	it("passes the result through untouched, failure included", async () => {
		const failure = { ok: false, status: 404, message: "No such project" };
		request.mockResolvedValue(failure);

		expect(await fetchStatus({ token: "tok", projectKey: "k" })).toBe(failure);
	});
});
