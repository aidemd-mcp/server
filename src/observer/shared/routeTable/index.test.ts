import { describe, expect, it } from "vitest";
import matchRoute from "../../handleRequest/matchRoute/index.js";
import routeTable from "./index.js";

describe("routeTable", () => {
	it("has a purpose on every row and no method-and-path listed twice", () => {
		const keys = routeTable.map((route) => `${route.method} ${route.path}`);
		expect(new Set(keys).size).toBe(keys.length);
		expect(routeTable.every((route) => route.purpose.length > 0)).toBe(true);
	});

	it("is exactly what the request matcher serves", () => {
		for (const route of routeTable) {
			const pathname = route.path.replace(/:\w+/g, "x");
			const match = matchRoute({ method: route.method, pathname });
			expect(match.kind).toBe("route");
			if (match.kind === "route") expect(match.readRoute).toBe(route.readRoute);
		}
	});
});

describe("routeTable — token access", () => {
	const open = routeTable.filter((route) => route.tokenAccess !== "required").map((route) => `${route.method} ${route.path} ${route.tokenAccess}`);

	it("opens only the home page for browsers, the session page shell and the assets", () => {
		expect(open).toEqual(["GET / open-for-html", "GET /p/:project/s/:session open", "GET /assets/:name open"]);
	});

	it("requires the token on every route that reads, changes or controls anything", () => {
		const required = routeTable.filter((route) => route.tokenAccess === "required");

		expect(required).toHaveLength(routeTable.length - 3);
		expect(required.every((route) => route.path.startsWith("/api/"))).toBe(true);
		expect(required.map((route) => route.name)).toEqual(expect.arrayContaining(["deleteSession", "postEvent", "postShutdown", "streamUpdates", "getFile", "getTask"]));
	});
});
