import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { HeldSession, ObserverContext } from "../types/index.js";

vi.mock("../rebuildStatus/index.js", () => ({ default: vi.fn() }));

import rebuildStatus from "../rebuildStatus/index.js";
import buildProjectView from "./index.js";

const mockRebuild = rebuildStatus as ReturnType<typeof vi.fn>;
const A = "alpha-aaaaaa";
const B = "beta-bbbbbb";
const C = "gamma-cccccc";

function makeStarted({ sessionId, root }: { sessionId: string; root?: string }): ObserverEvent {
	return { v: 1, ts: "2026-01-01T00:00:00.000Z", sessionId, seq: 1, pid: 1, kind: "session_started", ...(root !== undefined && { projectRoot: root }) };
}

const HELD: HeldSession[] = [
	{ projectKey: A, sessionId: "a", events: [makeStarted({ sessionId: "a", root: "/a" })] },
	{ projectKey: B, sessionId: "b", events: [makeStarted({ sessionId: "b", root: "/b" })] },
	{ projectKey: C, sessionId: "c", events: [makeStarted({ sessionId: "c" })] },
];

function makeContext(brainOverride?: { projectKey: string; brainPath: string }): ObserverContext {
	return {
		brainOverride,
		store: { sessions: ({ projectKey }: { projectKey?: string } = {}) => HELD.filter((session) => session.projectKey === projectKey) },
	} as unknown as ObserverContext;
}

describe("buildProjectView", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRebuild.mockResolvedValue({ marker: "status" });
	});

	it("is null for a project nobody holds and builds nothing", async () => {
		expect(await buildProjectView({ ctx: makeContext(), projectKey: "delta-dddddd" })).toBeNull();
		expect(mockRebuild).not.toHaveBeenCalled();
	});

	it("builds the status from that project's root and sessions only", async () => {
		const view = await buildProjectView({ ctx: makeContext(), projectKey: A });

		expect(view).toEqual({ state: "ready", projectKey: A, status: { marker: "status" } });
		expect(mockRebuild).toHaveBeenCalledWith({ projectKey: A, projectRoot: "/a", sessions: [HELD[0]], brainOverride: undefined });
	});

	it("answers no-project-root without building a status for a project that reported no root", async () => {
		const view = await buildProjectView({ ctx: makeContext(), projectKey: C });

		expect(view).toEqual({
			state: "no-project-root",
			projectKey: C,
			detail: "No session of this project reported its project root, so its files and board cannot be shown.",
		});
		expect(mockRebuild).not.toHaveBeenCalled();
	});

	it("passes the --brain override to the project it names and to no other", async () => {
		const ctx = makeContext({ projectKey: A, brainPath: "/override" });

		await buildProjectView({ ctx, projectKey: A });
		await buildProjectView({ ctx, projectKey: B });

		expect(mockRebuild).toHaveBeenNthCalledWith(1, expect.objectContaining({ projectRoot: "/a", brainOverride: "/override" }));
		expect(mockRebuild).toHaveBeenNthCalledWith(2, expect.objectContaining({ projectRoot: "/b", brainOverride: undefined }));
	});

	it("lets a throw from the status builder propagate", async () => {
		mockRebuild.mockRejectedValue(new Error("boom"));

		await expect(buildProjectView({ ctx: makeContext(), projectKey: A })).rejects.toThrow("boom");
	});
});
