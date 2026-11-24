import { describe, expect, it } from "vitest";
import parseRoute from "./index.js";

describe("parseRoute", () => {
	it("reads Home", () => {
		expect(parseRoute({ pathname: "/", search: "?token=abc" })).toEqual({ kind: "home", token: "abc" });
	});

	it("reads a session view with decoded segments, the tree tab and no item", () => {
		expect(parseRoute({ pathname: "/p/my%20app-1a2b3c/s/20260101T000000000Z-abcdef", search: "?token=abc" })).toEqual({
			kind: "session",
			token: "abc",
			projectKey: "my app-1a2b3c",
			sessionId: "20260101T000000000Z-abcdef",
			tab: "tree",
			item: null,
		});
	});

	it.each(["tree", "plans", "board", "record", "sessions", "history"])("reads the %s tab", (tab) => {
		expect(parseRoute({ pathname: "/p/k/s/s", search: `?token=t&tab=${tab}` })).toMatchObject({ kind: "session", tab });
	});

	it.each(["", "nope", "BOARD", "constructor", "__proto__"])("falls back to the tree tab for %j", (tab) => {
		expect(parseRoute({ pathname: "/p/k/s/s", search: `?token=t&tab=${tab}` })).toMatchObject({ tab: "tree" });
	});

	it("reads the open item and drops an unreadable one", () => {
		expect(parseRoute({ pathname: "/p/k/s/s", search: "?token=t&tab=plans&item=module%3Asrc%2Fa" })).toMatchObject({
			tab: "plans",
			item: { kind: "module", folder: "src/a" },
		});
		expect(parseRoute({ pathname: "/p/k/s/s", search: "?token=t&item=bogus" })).toMatchObject({ kind: "session", item: null });
	});

	it("accepts one trailing slash", () => {
		expect(parseRoute({ pathname: "/p/k/s/s/", search: "?token=t" })).toMatchObject({ kind: "session", projectKey: "k", sessionId: "s" });
	});

	it.each([
		"/p/k/s/s/x",
		"/p/k/s",
		"/p/k/s/",
		"/p//s/s",
		"/projects/k/sessions/s",
		"/p/k/x/s",
		"/other",
		"/p/%E0%A4%A/s/s",
		"/p/k/s/%E0%A4%A",
	])("treats %s as invalid", (pathname) => {
		expect(parseRoute({ pathname, search: "?token=t" })).toEqual({ kind: "invalid" });
	});

	it("makes every route invalid without a token", () => {
		expect(parseRoute({ pathname: "/", search: "" })).toEqual({ kind: "invalid" });
		expect(parseRoute({ pathname: "/p/k/s/s", search: "?token=" })).toEqual({ kind: "invalid" });
		expect(parseRoute({ pathname: "/p/k/s/s", search: "?tab=board" })).toEqual({ kind: "invalid" });
	});
});
