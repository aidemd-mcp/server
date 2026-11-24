import { Text } from "ink";
import { render } from "ink-testing-library";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import type { ProjectView } from "@/observer/types/index.js";
import type { StreamFrame, StreamState } from "@/observer/page/types/index.js";

vi.mock("@/observer/page/api/connectStream/index.js", () => ({ default: vi.fn() }));
vi.mock("./loadProjects/index.js", () => ({ default: vi.fn() }));
vi.mock("./loadSessions/index.js", () => ({ default: vi.fn() }));

import connectStream from "@/observer/page/api/connectStream/index.js";
import loadProjects from "./loadProjects/index.js";
import loadSessions from "./loadSessions/index.js";
import useObserverStream from "./index.js";

type StreamArgs = { token: string; projectKey?: string; onFrame: (frame: StreamFrame) => void; onConnection: (state: "live" | "reconnecting") => void };

const mockConnect = connectStream as ReturnType<typeof vi.fn>;
const mockLoadProjects = loadProjects as ReturnType<typeof vi.fn>;
const mockLoadSessions = loadSessions as ReturnType<typeof vi.fn>;

const closes: ReturnType<typeof vi.fn>[] = [];

beforeEach(() => {
	vi.clearAllMocks();
	closes.length = 0;
	mockConnect.mockImplementation(() => {
		const close = vi.fn();
		closes.push(close);
		return { close };
	});
	mockLoadProjects.mockResolvedValue(undefined);
	mockLoadSessions.mockResolvedValue(undefined);
});

/** Polls until the assertion holds (effects and renders land asynchronously); fails after a generous timeout. */
const until = (assertion: () => void) => vi.waitFor(assertion, { timeout: 5000, interval: 10 });

/** The arguments of the n-th stream the hook opened. */
const streamArgs = (index = 0): StreamArgs => mockConnect.mock.calls[index][0] as StreamArgs;

/** Mounts `useObserverStream` and exposes the latest state, re-rendering with a new link on demand. */
function mount(initial: { token: string; projectKey?: string }) {
	const latest: { state: StreamState | null } = { state: null };
	function Probe(props: { token: string; projectKey?: string }) {
		latest.state = useObserverStream(props);
		return createElement(Text, null, latest.state.connection);
	}
	const view = render(createElement(Probe, initial));
	return {
		view,
		rerender: (next: { token: string; projectKey?: string }) => view.rerender(createElement(Probe, next)),
		get state(): StreamState {
			if (latest.state === null) throw new Error("hook did not run");
			return latest.state;
		},
	};
}

describe("useObserverStream", () => {
	it("starts connecting with nothing held", async () => {
		const probe = mount({ token: "tok" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		expect(probe.state).toEqual({ connection: "connecting", held: [], views: {}, listings: {}, projects: null });
		probe.view.unmount();
	});

	it("opens one stream for the token and project it is given", async () => {
		const probe = mount({ token: "tok", projectKey: "app-abc123" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		expect(streamArgs()).toMatchObject({ token: "tok", projectKey: "app-abc123" });
		probe.view.unmount();
	});

	it("opens a stream for every project on Home, with no project key", async () => {
		const probe = mount({ token: "tok" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		expect(streamArgs().projectKey).toBeUndefined();
		probe.view.unmount();
	});

	it("folds the stream's frames and connection changes into the state", async () => {
		const probe = mount({ token: "tok", projectKey: "app-abc123" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		const { onFrame, onConnection } = streamArgs();
		const view: ProjectView = { state: "ready", projectKey: "app-abc123", status: makeStatus() };
		const event = makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "session_started" });

		onConnection("live");
		onFrame({ name: "status", data: { projectKey: "app-abc123", view } });
		onFrame({ name: "aide-event", data: { projectKey: "app-abc123", event } });

		await until(() => {
			expect(probe.state.connection).toBe("live");
			expect(probe.state.views["app-abc123"]).toEqual(view);
			expect(probe.state.held).toEqual([{ projectKey: "app-abc123", sessionId: "s1", events: [event] }]);
		});
		probe.view.unmount();
	});

	it("closes the stream on unmount", async () => {
		const probe = mount({ token: "tok", projectKey: "app-abc123" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		probe.view.unmount();
		expect(closes[0]).toHaveBeenCalledTimes(1);
	});

	it("closes the old stream and opens a new one when the project changes, and keeps one stream while it does not", async () => {
		const probe = mount({ token: "tok", projectKey: "a" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		probe.rerender({ token: "tok", projectKey: "a" });

		probe.rerender({ token: "tok", projectKey: "b" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(2));
		expect(closes[0]).toHaveBeenCalledTimes(1);
		expect(streamArgs(1).projectKey).toBe("b");
		probe.view.unmount();
	});

	it("loads the project list and each status on Home only", async () => {
		const home = mount({ token: "tok" });
		await until(() => expect(mockLoadProjects).toHaveBeenCalledTimes(1));
		expect(mockLoadProjects.mock.calls[0][0]).toMatchObject({ token: "tok" });
		home.view.unmount();

		mockLoadProjects.mockClear();
		const session = mount({ token: "tok", projectKey: "a" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(2));
		expect(mockLoadProjects).not.toHaveBeenCalled();
		session.view.unmount();
	});

	it("stops the Home load from dispatching once the page has moved on", async () => {
		const probe = mount({ token: "tok" });
		await until(() => expect(mockLoadProjects).toHaveBeenCalledTimes(1));
		const { isCancelled } = mockLoadProjects.mock.calls[0][0] as { isCancelled: () => boolean };
		expect(isCancelled()).toBe(false);

		probe.view.unmount();
		expect(isCancelled()).toBe(true);
	});

	it("fetches the session list of a project whose view has no root, on each such status frame", async () => {
		const probe = mount({ token: "tok", projectKey: "a" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		expect(mockLoadSessions).not.toHaveBeenCalled();

		streamArgs().onFrame({ name: "status", data: { projectKey: "a", view: { state: "no-project-root", projectKey: "a" } as ProjectView } });
		await until(() => expect(mockLoadSessions).toHaveBeenCalledTimes(1));
		expect(mockLoadSessions.mock.calls[0][0]).toMatchObject({ token: "tok", projectKey: "a" });

		streamArgs().onFrame({ name: "status", data: { projectKey: "a", view: { state: "no-project-root", projectKey: "a" } as ProjectView } });
		await until(() => expect(mockLoadSessions).toHaveBeenCalledTimes(2));
		probe.view.unmount();
	});

	it("does not fetch the session list of a project whose view is ready", async () => {
		const probe = mount({ token: "tok", projectKey: "a" });
		await until(() => expect(mockConnect).toHaveBeenCalledTimes(1));
		streamArgs().onFrame({ name: "status", data: { projectKey: "a", view: { state: "ready", projectKey: "a", status: makeStatus() } } });
		await until(() => expect(probe.state.views["a"]?.state).toBe("ready"));
		expect(mockLoadSessions).not.toHaveBeenCalled();
		probe.view.unmount();
	});
});
