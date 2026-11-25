import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, vi.fn()] };
});

import useDrawerHeight from "./index.js";

const KEY = "aide-viewer:bottom-drawer-height";
let stored: Record<string, string>;

beforeEach(() => {
	stored = {};
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (key: string) => stored[key] ?? null,
			setItem: (key: string, value: string) => {
				stored[key] = value;
			},
			removeItem: (key: string) => {
				delete stored[key];
			},
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useDrawerHeight", () => {
	it("keeps the default (null) until a height is remembered", () => {
		expect(useDrawerHeight({ min: 200, max: 600 }).height).toBeNull();
	});

	it("reads a remembered height clamped to the measured bounds", () => {
		stored[KEY] = "900";
		expect(useDrawerHeight({ min: 200, max: 600 }).height).toBe(600);
		stored[KEY] = "50";
		expect(useDrawerHeight({ min: 200, max: 600 }).height).toBe(200);
	});

	it("passes a remembered height through while the bounds are not measured yet", () => {
		stored[KEY] = "900";
		expect(useDrawerHeight({ min: 160, max: -120 }).height).toBe(900);
	});

	it("remembers a chosen height clamped to its bounds, and forgets it on reset", () => {
		const { setHeight, reset } = useDrawerHeight({ min: 200, max: 600 });
		setHeight(1000);
		expect(stored[KEY]).toBe("600");
		setHeight(420);
		expect(stored[KEY]).toBe("420");
		reset();
		expect(stored[KEY]).toBeUndefined();
	});
});
