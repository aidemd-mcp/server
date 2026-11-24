import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockTakeOver, mockTryBind, mockLaunch, mockAwait, mockVersion } = vi.hoisted(() => ({
	mockTakeOver: vi.fn(),
	mockTryBind: vi.fn(),
	mockLaunch: vi.fn(),
	mockAwait: vi.fn(),
	mockVersion: vi.fn(),
}));

vi.mock("@/observer/takeOver/index.js", () => ({ default: mockTakeOver }));
vi.mock("@/tools/observer/shared/tryBind/index.js", () => ({ default: mockTryBind }));
vi.mock("@/util/readPackageVersion/index.js", () => ({ default: mockVersion }));
vi.mock("./launchObserver/index.js", () => ({ default: mockLaunch }));
vi.mock("./awaitObserver/index.js", () => ({ default: mockAwait }));

import resolve from "@/util/runtimePaths/resolve/index.js";
import getSession from "@/service/observer/event/record/session/index.js";
import start, { ObserverStartInput } from "./index.js";

const root = process.cwd();
const input = { root, entryScript: "/pkg/dist/index.js" };
const observer = { address: "http://127.0.0.1:24680", token: "tok", pid: 9, version: "0.15.0" };

function viewLink(address = observer.address, token = observer.token): string {
	const { projectKey } = resolve({ projectRoot: root });
	return `${address}/p/${encodeURIComponent(projectKey)}/s/${encodeURIComponent(getSession().sessionId)}?token=${token}`;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockVersion.mockReturnValue("0.15.0");
	mockTryBind.mockResolvedValue(true);
	mockLaunch.mockReturnValue({ pid: 1 });
	mockAwait.mockResolvedValue({ outcome: "answered", observer });
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("ObserverStartInput", () => {
	it("takes no input and ignores an old port argument", () => {
		expect(ObserverStartInput.parse({})).toEqual({});
		expect(ObserverStartInput.parse({ port: 31000 })).toEqual({});
	});
});

describe("start", () => {
	it("starts when no observer runs, linking to this session's view", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "started", link: viewLink() });
		expect(mockTakeOver).toHaveBeenCalledWith({ version: "0.15.0" });
		expect(mockTryBind).toHaveBeenCalledWith(24680);
		expect(mockLaunch).toHaveBeenCalledWith({ root, port: 24680, entryScript: "/pkg/dist/index.js" });
		expect(mockAwait).toHaveBeenCalledWith({ port: 24680, child: { pid: 1 } });
	});

	it("keeps a same-or-newer running observer, spawning nothing, and links to this session's view", async () => {
		const running = { ...observer, address: "http://127.0.0.1:31999", token: "other" };
		mockTakeOver.mockResolvedValue({ outcome: "kept", observer: running });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "running", link: viewLink(running.address, "other") });
		expect(mockTryBind).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("reports started with the replaced version when an older observer was replaced", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "replaced", previous: { ...observer, version: "0.14.0" } });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "started", link: viewLink(), replaced: "0.14.0" });
		expect(mockLaunch).toHaveBeenCalledTimes(1);
	});

	it("reports stuck with both versions and the old observer's link, spawning nothing", async () => {
		const old = { ...observer, version: "0.14.0", address: "http://127.0.0.1:24681", token: "old" };
		mockTakeOver.mockResolvedValue({ outcome: "stuck", observer: old });

		const reply = await start(input);

		expect(reply).toEqual({
			outcome: "stuck",
			runningVersion: "0.14.0",
			ownVersion: "0.15.0",
			link: viewLink(old.address, "old"),
		});
		expect(mockTryBind).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("refuses an invalid AIDE_OBSERVER_PORT by name, probing and spawning nothing", async () => {
		vi.stubEnv("AIDE_OBSERVER_PORT", "abc");

		const reply = await start(input);

		expect(reply.outcome).toBe("not-started");
		expect(reply).toMatchObject({ reason: expect.stringContaining("AIDE_OBSERVER_PORT") });
		expect(reply).toMatchObject({ reason: expect.stringContaining('"abc"') });
		expect(mockTakeOver).not.toHaveBeenCalled();
		expect(mockTryBind).not.toHaveBeenCalled();
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("binds the port from AIDE_OBSERVER_PORT when set", async () => {
		vi.stubEnv("AIDE_OBSERVER_PORT", "31000");
		mockTakeOver.mockResolvedValue({ outcome: "none" });

		await start(input);

		expect(mockTryBind).toHaveBeenCalledWith(31000);
		expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ port: 31000 }));
	});

	it("reports a busy port by name and spawns nothing", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockTryBind.mockResolvedValue(false);

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "not-started", reason: "port 24680 is busy" });
		expect(mockLaunch).not.toHaveBeenCalled();
	});

	it("returns awaitObserver's not-started reply", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockAwait.mockResolvedValue({ outcome: "not-started", reason: "the observer did not answer" });

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "not-started", reason: "the observer did not answer" });
	});

	it("turns a throwing launch into not-started with the message", async () => {
		mockTakeOver.mockResolvedValue({ outcome: "none" });
		mockLaunch.mockImplementation(() => {
			throw new Error("spawn failed");
		});

		const reply = await start(input);

		expect(reply).toEqual({ outcome: "not-started", reason: "spawn failed" });
	});
});
