import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/requestJson/index.js", () => ({ default: vi.fn() }));

import requestJson from "@/observer/page/api/requestJson/index.js";
import fetchArchived from "./index.js";

const request = requestJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("fetchArchived", () => {
	it("asks for the project's archive path with the link's token", async () => {
		request.mockResolvedValue({ ok: true, data: { sessions: [] } });

		await fetchArchived({ token: "tok", projectKey: "my app-1a2b3c" });

		expect(request).toHaveBeenCalledWith({ path: "/api/projects/my%20app-1a2b3c/archive", token: "tok" });
	});
});
