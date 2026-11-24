import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/service/observer/event/read/index.js", () => ({ default: vi.fn() }));
vi.mock("@/util/runtimePaths/resolve/index.js", () => ({
	default: vi.fn(() => ({ projectKey: "my-project-ab12", folder: "", eventsFolder: "" })),
}));

import read from "@/service/observer/event/read/index.js";
import buildLink from "./index.js";

const mockRead = read as unknown as ReturnType<typeof vi.fn>;
const observer = { address: "http://127.0.0.1:24680", token: "tok" };

function makeProject(sessionIds: string[]) {
	return {
		projectKey: "my-project-ab12",
		projectRoot: "/project",
		sessions: sessionIds.map((sessionId) => ({
			sessionId,
			started: null,
			events: [],
			skippedLines: 0,
			live: false,
			unreadable: false,
		})),
	};
}

describe("buildLink", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("links the newest session of the launch project", async () => {
		mockRead.mockResolvedValue([makeProject(["older", "newer"])]);

		const link = await buildLink({ observer, projectRoot: "/project" });

		expect(mockRead).toHaveBeenCalledWith({ projectKey: "my-project-ab12" });
		expect(link).toBe("http://127.0.0.1:24680/p/my-project-ab12/s/newer?token=tok");
	});

	it("links home when the project has no sessions", async () => {
		mockRead.mockResolvedValue([]);

		expect(await buildLink({ observer, projectRoot: "/project" })).toBe("http://127.0.0.1:24680/?token=tok");
	});

	it("links home when the read throws", async () => {
		mockRead.mockRejectedValue(new Error("EACCES"));

		expect(await buildLink({ observer, projectRoot: "/project" })).toBe("http://127.0.0.1:24680/?token=tok");
	});
});
