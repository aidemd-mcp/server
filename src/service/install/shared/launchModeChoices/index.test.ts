import { describe, it, expect } from "vitest";
import launchModeChoices from "./index.js";

describe("launchModeChoices", () => {
	it("pins the global label and explanation", () => {
		expect(launchModeChoices.global).toEqual({
			label: "Global (recommended)",
			explanation:
				"personal machine, reliable startup; stays on its installed version; one-time `npm i -g`.",
		});
	});

	it("pins the local (aide) label and explanation", () => {
		expect(launchModeChoices.local).toEqual({
			label: "Local",
			explanation:
				"shared repos, cloud/CI; pinned to one version that /aide:upgrade moves forward; flaky cold start.",
		});
	});

	it("pins the localBrain label and explanation", () => {
		expect(launchModeChoices.localBrain).toEqual({
			label: "Local",
			explanation:
				"shared repos, cloud/CI; pinned to one version that /aide:brain config moves forward; flaky cold start.",
		});
	});
});
