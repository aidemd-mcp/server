import { describe, expect, it } from "vitest";
import buildViewLink from "./index.js";

const observer = { address: "http://127.0.0.1:24680", token: "abc123" };

describe("buildViewLink", () => {
	it("builds the home link", () => {
		expect(buildViewLink({ observer })).toBe("http://127.0.0.1:24680/?token=abc123");
	});

	it("builds a session view link", () => {
		const link = buildViewLink({
			observer,
			view: { projectKey: "proj-a1b2c3", sessionId: "20261123T101500000Z-ab12cd" },
		});
		expect(link).toBe(
			"http://127.0.0.1:24680/p/proj-a1b2c3/s/20261123T101500000Z-ab12cd?token=abc123",
		);
	});

	it("encodes a project key containing a space", () => {
		const link = buildViewLink({
			observer,
			view: { projectKey: "my proj-a1b2c3", sessionId: "s1" },
		});
		expect(link).toBe("http://127.0.0.1:24680/p/my%20proj-a1b2c3/s/s1?token=abc123");
	});
});
