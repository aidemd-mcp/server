import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, vi.fn()],
		useEffect: () => undefined,
	};
});

import useDetailWidth from "./index.js";

let stored: Record<string, string>;

beforeEach(() => {
	stored = {};
	vi.stubGlobal("window", {
		innerWidth: 1280,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
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

describe("useDetailWidth", () => {
	it("keeps the default (null) until a width is remembered, with bounds from the window", () => {
		expect(useDetailWidth()).toMatchObject({ width: null, min: 360, max: 960 });
	});

	it("reads a remembered width, clamped to the current window", () => {
		stored["aide-viewer:details-width"] = "700";
		expect(useDetailWidth().width).toBe(700);
		stored["aide-viewer:details-width"] = "5000";
		expect(useDetailWidth().width).toBe(960);
	});

	it("ignores a remembered value that is not a positive number", () => {
		stored["aide-viewer:details-width"] = "wide";
		expect(useDetailWidth().width).toBeNull();
	});

	it("remembers a chosen width clamped to its bounds, and forgets it on reset", () => {
		const { setWidth, reset } = useDetailWidth();
		setWidth(100);
		expect(stored["aide-viewer:details-width"]).toBe("360");
		setWidth(640);
		expect(stored["aide-viewer:details-width"]).toBe("640");
		reset();
		expect(stored["aide-viewer:details-width"]).toBeUndefined();
	});

	it("never goes below the minimum in a narrow window", () => {
		(window as { innerWidth: number }).innerWidth = 500;
		expect(useDetailWidth().max).toBe(360);
	});

	it("keeps working when storage is blocked", () => {
		vi.stubGlobal("window", {
			innerWidth: 1280,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			get localStorage(): Storage {
				throw new Error("blocked");
			},
		});
		const { width, setWidth, reset } = useDetailWidth();
		expect(width).toBeNull();
		expect(() => setWidth(500)).not.toThrow();
		expect(() => reset()).not.toThrow();
	});
});
