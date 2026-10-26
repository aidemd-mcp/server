import { describe, it, expect } from "vitest";
import listSkippedVersions from "./index.js";

describe("listSkippedVersions", () => {
	it.each([
		{
			name: "returns the releases after installed up to latest, newest first",
			installed: "0.12.0",
			latest: "0.13.1",
			versions: ["0.11.0", "0.12.0", "0.12.1", "0.13.0", "0.13.1"],
			expected: ["0.13.1", "0.13.0", "0.12.1"],
		},
		{
			name: "sorts unordered input newest first",
			installed: "0.12.0",
			latest: "0.13.1",
			versions: ["0.13.1", "0.12.1", "0.13.0"],
			expected: ["0.13.1", "0.13.0", "0.12.1"],
		},
		{
			name: "excludes prereleases",
			installed: "0.12.0",
			latest: "0.13.1",
			versions: ["0.12.1", "0.13.0-beta.1", "0.13.1"],
			expected: ["0.13.1", "0.12.1"],
		},
		{
			name: "excludes versions above latest",
			installed: "0.12.0",
			latest: "0.13.1",
			versions: ["0.13.0", "0.13.1", "0.14.0"],
			expected: ["0.13.1", "0.13.0"],
		},
		{
			name: "returns [] when installed equals latest",
			installed: "0.13.1",
			latest: "0.13.1",
			versions: ["0.12.0", "0.13.0", "0.13.1"],
			expected: [],
		},
		{
			name: "returns [] when installed is newer than latest",
			installed: "0.14.0",
			latest: "0.13.1",
			versions: ["0.13.0", "0.13.1", "0.14.0"],
			expected: [],
		},
		{
			name: "compares versions numerically",
			installed: "0.9.0",
			latest: "0.10.0",
			versions: ["0.9.0", "0.9.1", "0.10.0"],
			expected: ["0.10.0", "0.9.1"],
		},
	])("$name", ({ installed, latest, versions, expected }) => {
		expect(listSkippedVersions(installed, latest, versions)).toEqual(expected);
	});
});
