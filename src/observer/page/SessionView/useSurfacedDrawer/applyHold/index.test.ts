import { describe, expect, it } from "vitest";
import type { DrawerItem } from "@/observer/page/types/index.js";
import applyHold from "./index.js";

const file: DrawerItem = { kind: "file", path: "src/a/plan.aide" };

describe("applyHold", () => {
	it("swallows the first surfaced file while holding, and stops holding", () => {
		expect(applyHold({ open: file, holding: true })).toEqual({ open: null, holding: false });
	});

	it("keeps holding while nothing has surfaced", () => {
		expect(applyHold({ open: null, holding: true })).toEqual({ open: null, holding: true });
	});

	it("passes every open through once released", () => {
		expect(applyHold({ open: file, holding: false })).toEqual({ open: file, holding: false });
		expect(applyHold({ open: null, holding: false })).toEqual({ open: null, holding: false });
	});
});
