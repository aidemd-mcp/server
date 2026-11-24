import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/requestJson/index.js", () => ({ default: vi.fn() }));

import requestJson from "@/observer/page/api/requestJson/index.js";
import fetchTask from "./index.js";

const request = requestJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("fetchTask", () => {
	it("asks for the encoded task slug inside the project with the link's token", async () => {
		request.mockResolvedValue({ ok: true, data: {} });

		await fetchTask({ token: "tok", projectKey: "my app-1a2b3c", slug: "fix it" });

		expect(request).toHaveBeenCalledWith({ path: "/api/projects/my%20app-1a2b3c/task/fix%20it", token: "tok" });
	});

	it("passes the result through untouched, failure included", async () => {
		const failure = { ok: false, status: 404, message: "No such task" };
		request.mockResolvedValue(failure);

		expect(await fetchTask({ token: "tok", projectKey: "k", slug: "s" })).toBe(failure);
	});
});
