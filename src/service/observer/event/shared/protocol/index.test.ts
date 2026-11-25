import { describe, it, expect } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";

describe("protocol", () => {
	it("holds exactly the routes, headers, index marker, bind host, port list, presence route and session tag label", () => {
		expect(protocol).toEqual({
			eventsRoute: "/api/events",
			shutdownRoute: "/api/shutdown",
			tokenHeader: "x-aide-observer-token",
			projectHeader: "x-aide-observer-project",
			tokenQuery: "token",
			sessionRoute: "/p/:project/s/:session",
			indexMarker: "aide-observer",
			bindHost: "127.0.0.1",
			ports: [24680, 24681, 24682, 24683, 24684, 24685, 24686, 24687, 24688, 24689],
			presenceRoute: "/api/presence",
			sessionTagLabel: "observer-session",
			portEnvVar: "AIDE_OBSERVER_PORT",
		});
	});
});
