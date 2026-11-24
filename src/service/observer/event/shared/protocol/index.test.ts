import { describe, it, expect } from "vitest";
import protocol from "@/service/observer/event/shared/protocol/index.js";

describe("protocol", () => {
	it("holds exactly the routes, headers, index marker, bind host and port settings", () => {
		expect(protocol).toEqual({
			eventsRoute: "/api/events",
			shutdownRoute: "/api/shutdown",
			tokenHeader: "x-aide-observer-token",
			projectHeader: "x-aide-observer-project",
			tokenQuery: "token",
			sessionRoute: "/p/:project/s/:session",
			indexMarker: "aide-observer",
			bindHost: "127.0.0.1",
			defaultPort: 24680,
			portEnvVar: "AIDE_OBSERVER_PORT",
		});
	});
});
