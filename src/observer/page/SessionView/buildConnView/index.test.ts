import { describe, expect, it } from "vitest";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";
import type { ConnectionState, ConnState, SessionRowModel } from "@/observer/page/types/index.js";
import buildConnView from "./index.js";

const WORKING = makeLiveness();
const WAITING = makeLiveness({ state: "waiting" });
const STUCK = makeLiveness({ minutesQuiet: 20 });
const ENDED = makeLiveness({ state: "ended" });

describe("buildConnView", () => {
	it.each<[ConnectionState, SessionRowModel["liveness"] | null, ConnState]>([
		["reconnecting", WORKING, "recon"],
		["reconnecting", null, "recon"],
		["live", WORKING, "live"],
		["live", WAITING, "live"],
		["live", STUCK, "idle"],
		["live", ENDED, "idle"],
		["live", null, "idle"],
		["connecting", WORKING, "live"],
	])("with the stream %s and the session %j the pill is %s", (connection, liveness, expected) => {
		expect(buildConnView({ connection, session: liveness === null ? null : { liveness } })).toBe(expected);
	});
});
