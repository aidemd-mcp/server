import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";

const h = vi.hoisted(() => ({
	imported: { init: false, sync: false, view: false, tree: false, sdk: false },
	runInitCli: vi.fn(async () => {}),
	launchSync: vi.fn(async () => {}),
	view: vi.fn(async (_input: { args: string[]; projectRoot: string }) => 7),
	isMainModule: vi.fn((_input: { moduleUrl: string; entryPath: string | undefined }) => false),
}));

vi.mock("./init/index.js", () => {
	h.imported.init = true;
	return { runInitCli: h.runInitCli };
});
vi.mock("./launchSync/index.js", () => {
	h.imported.sync = true;
	return { default: h.launchSync };
});
vi.mock("./view/index.js", () => {
	h.imported.view = true;
	return { default: h.view };
});
vi.mock("./tree/index.js", () => {
	h.imported.tree = true;
	return {};
});
vi.mock("./isMainModule/index.js", () => ({ default: h.isMainModule }));
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
	h.imported.sdk = true;
	return { Server: vi.fn() };
});

let exitSpy: MockInstance;

async function loadRunCli() {
	return (await import("./index.js")).default;
}

beforeEach(() => {
	vi.resetModules();
	h.imported.init = h.imported.sync = h.imported.view = h.imported.tree = h.imported.sdk = false;
	h.runInitCli.mockClear();
	h.launchSync.mockClear();
	h.view.mockClear();
	h.isMainModule.mockReset();
	h.isMainModule.mockReturnValue(false);
	exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("runCli", () => {
	it("runs init only for ['init']", async () => {
		const runCli = await loadRunCli();

		expect(await runCli(["init"])).toBe(true);

		expect(h.runInitCli).toHaveBeenCalledTimes(1);
		expect(h.imported).toEqual({ init: true, sync: false, view: false, tree: false, sdk: false });
	});

	it("runs launchSync only for ['sync']", async () => {
		const runCli = await loadRunCli();

		expect(await runCli(["sync"])).toBe(true);

		expect(h.launchSync).toHaveBeenCalledTimes(1);
		expect(h.imported).toEqual({ init: false, sync: true, view: false, tree: false, sdk: false });
	});

	it("runs view with the remaining args and exits with its code for ['view', '--port', '41234']", async () => {
		const runCli = await loadRunCli();

		expect(await runCli(["view", "--port", "41234"])).toBe(true);

		expect(h.view).toHaveBeenCalledWith({
			args: ["--port", "41234"],
			projectRoot: process.cwd(),
		});
		expect(exitSpy).toHaveBeenCalledWith(7);
		expect(h.imported).toEqual({ init: false, sync: false, view: true, tree: false, sdk: false });
	});

	it.each([[[]], [["--root", "/some/path"]], [["upgrade"]]] as string[][][])(
		"returns false and imports no command for %j",
		async (args) => {
			const runCli = await loadRunCli();

			expect(await runCli(args)).toBe(false);

			expect(h.imported).toEqual({ init: false, sync: false, view: false, tree: false, sdk: false });
			expect(exitSpy).not.toHaveBeenCalled();
		},
	);
});

describe("main-script branch", () => {
	it("imports nothing when the file is imported", async () => {
		await loadRunCli();

		expect(h.isMainModule).toHaveBeenCalledTimes(1);
		const input = h.isMainModule.mock.calls[0]![0];
		expect(input.entryPath).toBe(process.argv[1]);
		expect(input.moduleUrl).toMatch(/\/cli\/index\.ts$/);
		expect(h.imported).toEqual({ init: false, sync: false, view: false, tree: false, sdk: false });
	});

	it("imports the explorer, and no command or SDK, when the file is the main script", async () => {
		h.isMainModule.mockReturnValue(true);

		await loadRunCli();

		expect(h.imported).toEqual({ init: false, sync: false, view: false, tree: true, sdk: false });
		expect(exitSpy).not.toHaveBeenCalled();
	});
});
