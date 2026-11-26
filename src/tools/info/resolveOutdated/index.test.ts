import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./listStaleFiles/index.js", () => ({ default: vi.fn() }));
vi.mock("./detectStaleHooks/index.js", () => ({ default: vi.fn() }));

import listStaleFiles from "./listStaleFiles/index.js";
import detectStaleHooks from "./detectStaleHooks/index.js";
import resolveOutdated from "./index.js";

const mockListStaleFiles = listStaleFiles as ReturnType<typeof vi.fn>;
const mockDetectStaleHooks = detectStaleHooks as ReturnType<typeof vi.fn>;

const root = "/project/root";

describe("resolveOutdated", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockListStaleFiles.mockReturnValue([]);
		mockDetectStaleHooks.mockResolvedValue(false);
	});

	it("returns [\"hooks\"] when versions.json is current and the hooks are stale", async () => {
		mockDetectStaleHooks.mockResolvedValue(true);

		expect(await resolveOutdated(root)).toEqual(["hooks"]);
	});

	it("returns [] when the hooks match and versions.json is current", async () => {
		expect(await resolveOutdated(root)).toEqual([]);
	});

	it("returns [\"hooks\"] when versions.json is missing (no stale files) and the hooks are stale", async () => {
		mockListStaleFiles.mockReturnValue([]);
		mockDetectStaleHooks.mockResolvedValue(true);

		expect(await resolveOutdated(root)).toEqual(["hooks"]);
	});

	it("puts the stale file keys first and hooks last", async () => {
		mockListStaleFiles.mockReturnValue(["docs/aide-spec", "commands/aide/spec"]);
		mockDetectStaleHooks.mockResolvedValue(true);

		expect(await resolveOutdated(root)).toEqual(["docs/aide-spec", "commands/aide/spec", "hooks"]);
	});

	it("returns only the file keys when the hooks are current", async () => {
		mockListStaleFiles.mockReturnValue(["docs/aide-spec"]);

		expect(await resolveOutdated(root)).toEqual(["docs/aide-spec"]);
	});

	it("passes the root to both helpers", async () => {
		await resolveOutdated(root);

		expect(mockListStaleFiles).toHaveBeenCalledWith(root);
		expect(mockDetectStaleHooks).toHaveBeenCalledWith(root);
	});
});
