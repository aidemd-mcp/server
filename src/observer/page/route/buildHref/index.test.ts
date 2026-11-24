import { describe, expect, it } from "vitest";
import type { DrawerItem, HrefTarget, SessionTab } from "@/observer/page/types/index.js";
import parseRoute from "@/observer/page/route/parseRoute/index.js";
import buildHref from "./index.js";

function split(href: string): { pathname: string; search: string } {
	const mark = href.indexOf("?");
	return mark === -1 ? { pathname: href, search: "" } : { pathname: href.slice(0, mark), search: href.slice(mark) };
}

describe("buildHref", () => {
	it("builds Home", () => {
		expect(buildHref({ kind: "home", token: "t k" })).toBe("/?token=t%20k");
	});

	it("builds a session with the token only, omitting the default tab and an empty item", () => {
		expect(buildHref({ kind: "session", token: "t", projectKey: "app-abc123", sessionId: "s1" })).toBe("/p/app-abc123/s/s1?token=t");
		expect(buildHref({ kind: "session", token: "t", projectKey: "k", sessionId: "s", tab: "tree", item: null })).toBe("/p/k/s/s?token=t");
	});

	it("adds the tab and encodes every piece", () => {
		expect(buildHref({ kind: "session", token: "t k", projectKey: "my app", sessionId: "a/b", tab: "board" })).toBe(
			"/p/my%20app/s/a%2Fb?token=t%20k&tab=board",
		);
	});

	it.each<[DrawerItem, string]>([
		[{ kind: "module", folder: "src/tools/score" }, "module%3Asrc%2Ftools%2Fscore"],
		[{ kind: "module", folder: "." }, "module%3A."],
		[{ kind: "task", slug: "fix-it" }, "task%3Afix-it"],
		[{ kind: "file", path: "a b/plan.aide" }, "file%3Aa%20b%2Fplan.aide"],
		[{ kind: "event", sessionId: "s1", seq: 4 }, "event%3As1%3A4"],
	])("encodes the item %j", (item, encoded) => {
		expect(buildHref({ kind: "session", token: "t", projectKey: "k", sessionId: "s", tab: "plans", item })).toBe(
			`/p/k/s/s?token=t&tab=plans&item=${encoded}`,
		);
	});

	describe("round trip with parseRoute", () => {
		const tabs: SessionTab[] = ["tree", "plans", "board", "record", "sessions", "history"];
		const items: (DrawerItem | null)[] = [
			null,
			{ kind: "module", folder: "src/a b" },
			{ kind: "module", folder: "." },
			{ kind: "task", slug: "x&y=z" },
			{ kind: "file", path: "d/é+#?.aide" },
			{ kind: "event", sessionId: "s:1", seq: 12 },
		];

		it.each(tabs.flatMap((tab) => items.map((item) => [tab, item] as const)))("tab %s, item %j", (tab, item) => {
			const target: HrefTarget = { kind: "session", token: "tok/en", projectKey: "my app", sessionId: "a/b c", tab, item };
			expect(parseRoute(split(buildHref(target)))).toEqual({
				kind: "session",
				token: "tok/en",
				projectKey: "my app",
				sessionId: "a/b c",
				tab,
				item,
			});
		});

		it("round-trips Home", () => {
			expect(parseRoute(split(buildHref({ kind: "home", token: "a b" })))).toEqual({ kind: "home", token: "a b" });
		});
	});
});
