import { describe, expect, it } from "vitest";
import type { ConnectionState, ConnState, SessionRowModel } from "@/observer/page/types/index.js";
import buildConnView from "./index.js";

describe("buildConnView", () => {
	it.each<[ConnectionState, SessionRowModel["liveness"] | null, ConnState]>([
		["reconnecting", "live", "recon"],
		["reconnecting", null, "recon"],
		["live", "live", "live"],
		["live", "idle", "idle"],
		["live", "ended", "idle"],
		["live", null, "idle"],
		["connecting", "live", "live"],
	])("with the stream %s and the session %s the pill is %s", (connection, liveness, expected) => {
		expect(buildConnView({ connection, session: liveness === null ? null : { liveness } })).toBe(expected);
	});
});
