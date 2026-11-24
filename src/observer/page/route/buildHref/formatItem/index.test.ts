import { describe, expect, it } from "vitest";
import type { DrawerItem } from "@/observer/page/types/index.js";
import formatItem from "./index.js";

describe("formatItem", () => {
	it.each<[DrawerItem, string]>([
		[{ kind: "module", folder: "src/tools/score" }, "module:src/tools/score"],
		[{ kind: "task", slug: "fix-login" }, "task:fix-login"],
		[{ kind: "file", path: "src/a/plan.aide" }, "file:src/a/plan.aide"],
		[{ kind: "event", sessionId: "s1", seq: 12 }, "event:s1:12"],
	])("writes %j as %s", (item, text) => {
		expect(formatItem(item)).toBe(text);
	});
});
