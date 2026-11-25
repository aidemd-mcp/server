import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionLiveness } from "@/types/index.js";
import type { HeldSession, ObserverContext } from "../../types/index.js";

vi.mock("@/service/observer/event/readLiveness/index.js", () => ({ default: vi.fn() }));

import readLiveness from "@/service/observer/event/readLiveness/index.js";
import announceSessions from "./index.js";

const mockReadLiveness = readLiveness as ReturnType<typeof vi.fn>;
const KEY = "a-aaaaaa";
const WAITING: SessionLiveness = { state: "waiting", lastActivityAt: null, quietMinutes: 2, maybeStuck: false };

function makeContext({ held }: { held: HeldSession[] }) {
	const broadcast = vi.fn();
	const push = vi.fn();
	const sessions = vi.fn(({ projectKey }: { projectKey?: string } = {}) =>
		projectKey === undefined ? held : held.filter((session) => session.projectKey === projectKey),
	);
	const ctx = { store: { sessions }, hub: { broadcast }, statusPusher: { push }, now: () => 1 } as unknown as ObserverContext;
	return { ctx, broadcast, push };
}

describe("announceSessions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockReadLiveness.mockResolvedValue({ sessions: { s1: WAITING }, unlinked: [] });
	});

	it("reads liveness first, then broadcasts the project's rows, the home list and pushes the status", async () => {
		const { ctx, broadcast, push } = makeContext({ held: [{ projectKey: KEY, sessionId: "s1", events: [] }] });

		await announceSessions({ ctx, projectKey: KEY });

		const names = broadcast.mock.calls.map(([frame]) => frame.name);
		expect(names).toEqual(["sessions", "projects"]);
		expect(broadcast.mock.calls[0]![0]).toMatchObject({
			name: "sessions",
			projectKey: KEY,
			data: { projectKey: KEY, sessions: [{ sessionId: "s1", liveness: WAITING }] },
		});
		expect(push).toHaveBeenCalledWith(KEY);
	});

	it("announces an empty list for a project that holds no session any more", async () => {
		const { ctx, broadcast, push } = makeContext({ held: [] });

		await announceSessions({ ctx, projectKey: KEY });

		expect(broadcast.mock.calls[0]![0]).toMatchObject({ name: "sessions", data: { projectKey: KEY, sessions: [] } });
		expect(push).toHaveBeenCalledWith(KEY);
	});
});
