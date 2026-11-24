import { afterEach, describe, expect, it, vi } from "vitest";
import fetchProjects from "@/observer/page/api/fetchProjects/index.js";
import fetchStatus from "@/observer/page/api/fetchStatus/index.js";
import loadProjects from "./index.js";

vi.mock("@/observer/page/api/fetchProjects/index.js", () => ({ default: vi.fn() }));
vi.mock("@/observer/page/api/fetchStatus/index.js", () => ({ default: vi.fn() }));

const listing = (projectKey: string) => ({ projectKey, projectRoot: null, sessions: [], lastEventAt: null });

afterEach(() => {
	vi.restoreAllMocks();
});

describe("loadProjects", () => {
	it("dispatches the project list, then each project's view", async () => {
		vi.mocked(fetchProjects).mockResolvedValue({ ok: true, data: { projects: [listing("a-111111"), listing("b-222222")] } });
		vi.mocked(fetchStatus).mockImplementation(async ({ projectKey }) => ({
			ok: true,
			data: { state: "no-project-root", projectKey, detail: "none" },
		}));
		const dispatch = vi.fn();

		await loadProjects({ token: "t", dispatch, isCancelled: () => false });

		expect(dispatch).toHaveBeenCalledWith({ name: "projects", data: { projects: [listing("a-111111"), listing("b-222222")] } });
		expect(dispatch).toHaveBeenCalledWith({
			name: "status",
			data: { projectKey: "b-222222", view: { state: "no-project-root", projectKey: "b-222222", detail: "none" } },
		});
		expect(dispatch).toHaveBeenCalledTimes(3);
		expect(fetchStatus).toHaveBeenCalledWith({ token: "t", projectKey: "a-111111" });
	});

	it("logs a failed list and dispatches nothing", async () => {
		vi.mocked(fetchProjects).mockResolvedValue({ ok: false, status: 503, message: "replaying" });
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const dispatch = vi.fn();

		await loadProjects({ token: "t", dispatch, isCancelled: () => false });

		expect(dispatch).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledOnce();
	});

	it("dispatches nothing once cancelled", async () => {
		vi.mocked(fetchProjects).mockResolvedValue({ ok: true, data: { projects: [listing("a-111111")] } });
		const dispatch = vi.fn();

		await loadProjects({ token: "t", dispatch, isCancelled: () => true });

		expect(dispatch).not.toHaveBeenCalled();
		expect(fetchStatus).not.toHaveBeenCalled();
	});
});
