import { describe, it, expect } from "vitest";
import readReleaseBullets from "./index.js";

const CHANGELOG = [
	"# Changelog",
	"",
	"All notable changes are recorded here.",
	"",
	"## [Unreleased]",
	"",
	"### Added",
	"",
	"- An unreleased feature.",
	"",
	"## [0.13.1] - 2026-10-26",
	"",
	"### Changed",
	"",
	"- Changed bullet in 0.13.1.",
	"- [migration] Intent specs record `alignment` instead of `status`.",
	"  - Detect: an intent spec with `status:` and no `alignment:`.",
	"  - Migrate: rename the field.",
	"",
	"### Fixed",
	"",
	"- Fixed bullet in 0.13.1.",
	"",
	"## [0.13.0] - 2026-10-26",
	"",
	"### Added",
	"",
	"- Added bullet in 0.13.0.",
	"",
	"### Removed",
	"",
	"- Removed bullet in 0.13.0.",
	"",
].join("\n");

const EXPECTED = [
	{
		version: "0.13.1",
		heading: "Changed",
		text: "Changed bullet in 0.13.1.",
	},
	{ version: "0.13.1", heading: "Fixed", text: "Fixed bullet in 0.13.1." },
	{ version: "0.13.0", heading: "Added", text: "Added bullet in 0.13.0." },
];

describe("readReleaseBullets", () => {
	it("returns only top-level Added, Fixed and Changed bullets of released versions, in document order", () => {
		expect(readReleaseBullets(CHANGELOG)).toEqual(EXPECTED);
	});

	it("gives the same result for CRLF line endings", () => {
		expect(readReleaseBullets(CHANGELOG.replace(/\n/g, "\r\n"))).toEqual(
			EXPECTED,
		);
	});

	it("returns [] for an empty string", () => {
		expect(readReleaseBullets("")).toEqual([]);
	});

	it("returns [] when the file has no versioned heading", () => {
		expect(
			readReleaseBullets("# Changelog\n\n### Added\n\n- A bullet.\n"),
		).toEqual([]);
	});
});
