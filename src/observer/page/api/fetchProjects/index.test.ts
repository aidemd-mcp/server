import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/requestJson/index.js", () => ({ default: vi.fn() }));

import requestJson from "@/observer/page/api/requestJson/index.js";
import fetchProjects from "./index.js";

const request = requestJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("fetchProjects", () => {
	it("asks for /api/projects with the link's token", async () => {
		request.mockResolvedValue({ ok: true, data: { projects: [] } });

		await fetchProjects({ token: "tok" });

		expect(request).toHaveBeenCalledWith({ path: "/api/projects", token: "tok" });
	});

	it("passes the result through untouched, failure included", async () => {
		const failure = { ok: false, status: 401, message: "Invalid token" };
		request.mockResolvedValue(failure);

		expect(await fetchProjects({ token: "bad" })).toBe(failure);
	});
});
