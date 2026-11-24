import { describe, expect, it, vi } from "vitest";
import openSession from "./index.js";

describe("openSession", () => {
	it("navigates to the link it is given", () => {
		const navigate = vi.fn();
		openSession({ href: "/p/alpha-111111/s/s1?token=t", navigate });
		expect(navigate).toHaveBeenCalledWith("/p/alpha-111111/s/s1?token=t");
	});

	it("defaults to the browser's own navigation", () => {
		const assign = vi.fn();
		vi.stubGlobal("window", { location: { assign } });
		openSession({ href: "/?token=t" });
		vi.unstubAllGlobals();
		expect(assign).toHaveBeenCalledWith("/?token=t");
	});
});
