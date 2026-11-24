import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/page/api/requestJson/index.js", () => ({ default: vi.fn() }));

import requestJson from "@/observer/page/api/requestJson/index.js";
import fetchFile from "./index.js";

const request = requestJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("fetchFile", () => {
	it("asks for the encoded file path inside the project with the link's token", async () => {
		request.mockResolvedValue({ ok: true, data: { path: "src/a b/plan.aide", text: "" } });

		await fetchFile({ token: "tok", projectKey: "my app-1a2b3c", path: "src/a b/plan.aide" });

		expect(request).toHaveBeenCalledWith({
			path: "/api/projects/my%20app-1a2b3c/file?path=src%2Fa%20b%2Fplan.aide",
			token: "tok",
		});
	});

	it("passes the result through untouched, failure included", async () => {
		const failure = { ok: false, status: 404, message: "File not found" };
		request.mockResolvedValue(failure);

		expect(await fetchFile({ token: "tok", projectKey: "k", path: "x" })).toBe(failure);
	});
});
