import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observer/index.js", () => ({ default: vi.fn() }));
vi.mock("./buildLink/index.js", () => ({ default: vi.fn() }));
vi.mock("@/util/readPackageVersion/index.js", () => ({ default: vi.fn(() => "0.16.0") }));

import startObserver from "@/observer/index.js";
import buildLink from "./buildLink/index.js";
import view from "./index.js";

const startObserverMock = startObserver as ReturnType<typeof vi.fn>;
const buildLinkMock = buildLink as ReturnType<typeof vi.fn>;
const LINK = "http://127.0.0.1:24680/p/p-ab12/s/s1?token=abc123";
const projectRoot = resolve("/project/root");
const observer = { address: "http://127.0.0.1:24680", token: "abc123", pid: 4242, version: "0.16.0" };

describe("view", () => {
	let stdout: string;
	let stderr: string;
	let originalOut: typeof process.stdout.write;
	let originalErr: typeof process.stderr.write;
	let originalEnvPort: string | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		buildLinkMock.mockResolvedValue(LINK);
		originalEnvPort = process.env.AIDE_OBSERVER_PORT;
		delete process.env.AIDE_OBSERVER_PORT;
		stdout = "";
		stderr = "";
		originalOut = process.stdout.write;
		originalErr = process.stderr.write;
		process.stdout.write = ((chunk: string) => {
			stdout += chunk;
			return true;
		}) as typeof process.stdout.write;
		process.stderr.write = ((chunk: string) => {
			stderr += chunk;
			return true;
		}) as typeof process.stderr.write;
	});

	afterEach(() => {
		process.stdout.write = originalOut;
		process.stderr.write = originalErr;
		if (originalEnvPort === undefined) delete process.env.AIDE_OBSERVER_PORT;
		else process.env.AIDE_OBSERVER_PORT = originalEnvPort;
	});

	it("prints usage on stdout and returns 2 for --help without starting", async () => {
		await expect(view({ args: ["--help"], projectRoot })).resolves.toBe(2);
		expect(stdout).toContain("Usage: ");
		expect(startObserverMock).not.toHaveBeenCalled();
	});

	it("reports invalid arguments on stderr and returns 2 without starting", async () => {
		await expect(view({ args: ["--bogus"], projectRoot })).resolves.toBe(2);
		expect(stderr).toContain('Error: Unknown argument "--bogus"');
		expect(stderr).toContain("Usage: ");
		expect(startObserverMock).not.toHaveBeenCalled();
	});

	describe("port choice", () => {
		beforeEach(() => {
			startObserverMock.mockResolvedValue({ outcome: "kept", observer });
		});

		it("starts on the default port 24680 with no flag and no environment value", async () => {
			await view({ args: [], projectRoot });
			expect(startObserverMock).toHaveBeenCalledWith({ port: 24680 });
		});

		it("uses AIDE_OBSERVER_PORT when no flag is given", async () => {
			process.env.AIDE_OBSERVER_PORT = "31000";
			await view({ args: [], projectRoot });
			expect(startObserverMock).toHaveBeenCalledWith({ port: 31000 });
		});

		it("lets --port beat the environment", async () => {
			process.env.AIDE_OBSERVER_PORT = "31000";
			await view({ args: ["--port", "32000"], projectRoot });
			expect(startObserverMock).toHaveBeenCalledWith({ port: 32000 });
		});

		it("exits 1 naming the bad AIDE_OBSERVER_PORT value and starts nothing", async () => {
			process.env.AIDE_OBSERVER_PORT = "abc";
			await expect(view({ args: [], projectRoot })).resolves.toBe(1);
			expect(stderr).toContain("Observer not started: ");
			expect(stderr).toContain('"abc"');
			expect(stderr).toContain("AIDE_OBSERVER_PORT");
			expect(startObserverMock).not.toHaveBeenCalled();
		});
	});

	describe("brain override", () => {
		beforeEach(() => {
			startObserverMock.mockResolvedValue({ outcome: "kept", observer });
		});

		it("passes brainOverride for this project only with --brain", async () => {
			await view({ args: ["--brain", "../brain"], projectRoot });
			expect(startObserverMock).toHaveBeenCalledWith({
				port: 24680,
				brainOverride: { projectRoot, brainPath: resolve(projectRoot, "../brain") },
			});
		});

		it("passes no brainOverride without --brain", async () => {
			await view({ args: [], projectRoot });
			expect(startObserverMock.mock.calls[0]![0]).not.toHaveProperty("brainOverride");
		});
	});

	describe("kept", () => {
		it("prints the link and returns 0", async () => {
			startObserverMock.mockResolvedValue({ outcome: "kept", observer });
			await expect(view({ args: [], projectRoot })).resolves.toBe(0);
			expect(stdout).toBe(`Observer already running at ${LINK}\n`);
			expect(buildLinkMock).toHaveBeenCalledWith({ observer, projectRoot });
		});

		it("adds a note when --brain was given", async () => {
			startObserverMock.mockResolvedValue({ outcome: "kept", observer });
			await expect(view({ args: ["--brain", "../brain"], projectRoot })).resolves.toBe(0);
			expect(stdout).toBe(
				`Observer already running at ${LINK}\n` +
					"Note: --brain applies only when this command starts the observer; the running observer keeps its own setting.\n",
			);
		});
	});

	it("exits 1 naming both versions and the link when the old observer is stuck", async () => {
		startObserverMock.mockResolvedValue({ outcome: "stuck", observer: { ...observer, version: "0.14.0" } });
		await expect(view({ args: [], projectRoot })).resolves.toBe(1);
		expect(stderr).toBe(
			`Observer not replaced: the running observer is version 0.14.0, older than this AIDE (0.16.0), and did not shut down; it is still serving at ${LINK}\n`,
		);
	});

	it("exits 1 with the reason on stderr when not started", async () => {
		const reason = "Port 24680 is busy; the observer did not start. Another program is using it.";
		startObserverMock.mockResolvedValue({ outcome: "not-started", reason });
		await expect(view({ args: [], projectRoot })).resolves.toBe(1);
		expect(stderr).toBe(`Observer not started: ${reason}\n`);
		expect(buildLinkMock).not.toHaveBeenCalled();
	});

	it("exits 1 when startObserver throws", async () => {
		startObserverMock.mockRejectedValue(new Error("disk gone"));
		await expect(view({ args: [], projectRoot })).resolves.toBe(1);
		expect(stderr).toBe("Observer not started: disk gone\n");
	});

	it("exits 1 when the link cannot be built, stopping an observer it started", async () => {
		const stop = vi.fn().mockResolvedValue(undefined);
		startObserverMock.mockResolvedValue({ outcome: "started", observer, stop, stopped: new Promise(() => undefined) });
		buildLinkMock.mockRejectedValue(new Error("runtime folder is inside the project"));
		await expect(view({ args: [], projectRoot })).resolves.toBe(1);
		expect(stderr).toBe("Observer not started: runtime folder is inside the project\n");
		expect(stop).toHaveBeenCalledTimes(1);
	});

	describe("started", () => {
		it("serves until SIGINT, then stops once and returns 0", async () => {
			const stop = vi.fn().mockResolvedValue(undefined);
			startObserverMock.mockResolvedValue({ outcome: "started", observer, stop, stopped: new Promise(() => undefined) });

			const running = view({ args: [], projectRoot });
			await vi.waitFor(() => expect(stdout).toContain(`Observer running at ${LINK} (Ctrl+C to stop)\n`));
			expect(stop).not.toHaveBeenCalled();

			process.emit("SIGINT");
			await expect(running).resolves.toBe(0);

			expect(stop).toHaveBeenCalledTimes(1);
			expect(stdout).toContain("Observer stopped\n");
		});

		it("ends cleanly when stopped settles, without calling stop again", async () => {
			const stop = vi.fn().mockResolvedValue(undefined);
			let markStopped: () => void = () => undefined;
			const stopped = new Promise<void>((done) => {
				markStopped = done;
			});
			startObserverMock.mockResolvedValue({ outcome: "started", observer, stop, stopped });

			const running = view({ args: [], projectRoot });
			await vi.waitFor(() => expect(stdout).toContain("(Ctrl+C to stop)\n"));

			markStopped();
			await expect(running).resolves.toBe(0);

			expect(stop).not.toHaveBeenCalled();
			expect(stdout).toContain("Observer stopped\n");
		});
	});
});
