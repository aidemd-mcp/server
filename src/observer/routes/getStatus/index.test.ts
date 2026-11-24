import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { ObserverContext, RouteInput } from "../../types/index.js";

vi.mock("../../buildProjectView/index.js", () => ({ default: vi.fn() }));

import buildProjectView from "../../buildProjectView/index.js";
import getStatus from "./index.js";

const mockBuild = buildProjectView as ReturnType<typeof vi.fn>;
const KEY = "alpha-aaaaaa";

function makeInput(): { input: RouteInput; sent: { status: number; body: string }; ctx: ObserverContext } {
	const sent = { status: 0, body: "" };
	const res = {
		writeHead: (status: number) => {
			sent.status = status;
		},
		end: (body: string) => {
			sent.body = body;
		},
	} as unknown as ServerResponse;
	const ctx = {} as unknown as ObserverContext;
	return { input: { req: {} as RouteInput["req"], res, url: new URL("http://127.0.0.1/"), params: { project: KEY }, ctx }, sent, ctx };
}

describe("getStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("answers 200 with the project's view", async () => {
		mockBuild.mockResolvedValue({ state: "ready", projectKey: KEY, status: { marker: "status" } });
		const { input, sent, ctx } = makeInput();

		await getStatus(input);

		expect(mockBuild).toHaveBeenCalledWith({ ctx, projectKey: KEY });
		expect(sent.status).toBe(200);
		expect(JSON.parse(sent.body)).toEqual({ data: { state: "ready", projectKey: KEY, status: { marker: "status" } } });
	});

	it("answers the no-project-root view as 200", async () => {
		mockBuild.mockResolvedValue({ state: "no-project-root", projectKey: KEY, detail: "d" });
		const { input, sent } = makeInput();

		await getStatus(input);

		expect(sent.status).toBe(200);
		expect(JSON.parse(sent.body).data.state).toBe("no-project-root");
	});

	it("answers 404 when no such project is held", async () => {
		mockBuild.mockResolvedValue(null);
		const { input, sent } = makeInput();

		await getStatus(input);

		expect(sent.status).toBe(404);
		expect(JSON.parse(sent.body)).toEqual({ error: { message: "No such project." } });
	});

	it("lets a rebuild throw propagate for handleRequest's 500", async () => {
		mockBuild.mockRejectedValue(new Error("boom"));
		const { input, sent } = makeInput();

		await expect(getStatus(input)).rejects.toThrow("boom");
		expect(sent.status).toBe(0);
	});
});
