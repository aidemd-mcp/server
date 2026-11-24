import { describe, it, expect } from "vitest";
import createSessionId from "@/service/observer/event/record/session/createSessionId/index.js";
import resolveEventLog from "@/util/runtimePaths/resolveEventLog/index.js";

describe("createSessionId", () => {
	it("matches the YYYYMMDDTHHmmssSSSZ-<6 hex> shape", () => {
		expect(createSessionId({ now: new Date() })).toMatch(/^\d{8}T\d{9}Z-[0-9a-f]{6}$/);
	});

	it("starts with the zero-padded UTC time of now", () => {
		const id = createSessionId({ now: new Date("2026-11-22T14:30:05.123Z") });
		expect(id.startsWith("20261122T143005123Z-")).toBe(true);
	});

	it("sorts earlier and later dates in time order as plain strings", () => {
		const earlier = createSessionId({ now: new Date("2026-01-02T03:04:05.006Z") });
		const later = createSessionId({ now: new Date("2026-11-22T14:30:05.123Z") });
		expect([later, earlier].sort()).toEqual([earlier, later]);
	});

	it("gives distinct ids for the same instant", () => {
		const now = new Date("2026-11-22T14:30:05.123Z");
		const ids = new Set(Array.from({ length: 100 }, () => createSessionId({ now })));
		expect(ids.size).toBeGreaterThanOrEqual(99);
	});

	it("passes the real resolveEventLog without throwing", () => {
		const id = createSessionId({ now: new Date() });
		const projectRoot = process.platform === "win32" ? "C:\\some\\project" : "/some/project";
		expect(() => resolveEventLog({ projectRoot, sessionId: id })).not.toThrow();
	});
});
