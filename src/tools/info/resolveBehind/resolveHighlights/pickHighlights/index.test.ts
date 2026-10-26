import { describe, it, expect } from "vitest";
import pickHighlights from "./index.js";

const CHANGELOG = [
	"# Changelog",
	"",
	"## [Unreleased]",
	"",
	"### Added",
	"",
	"- Unreleased thing.",
	"",
	"## [0.13.1] - 2026-10-26",
	"",
	"### Changed",
	"",
	"- Changed one.",
	"",
	"### Fixed",
	"",
	"- Fixed one.",
	"",
	"## [0.13.0] - 2026-10-25",
	"",
	"### Added",
	"",
	"- Added A.",
	"- Added B.",
	"",
	"## [0.12.1] - 2026-10-24",
	"",
	"### Added",
	"",
	"- Added old.",
	"",
].join("\n");

describe("pickHighlights", () => {
	it("picks Added then Fixed, newest release first, capped at three, leaving Changed and unskipped releases out", () => {
		expect(pickHighlights(CHANGELOG, ["0.13.1", "0.13.0"])).toEqual([
			"Added A.",
			"Added B.",
			"Fixed one.",
		]);
	});

	it("puts the newer version's Added bullet first across versions", () => {
		const changelog = [
			"## [0.13.1]",
			"### Added",
			"- Newer.",
			"## [0.13.0]",
			"### Added",
			"- Older.",
		].join("\n");
		expect(pickHighlights(changelog, ["0.13.1", "0.13.0"])).toEqual(["Newer.", "Older."]);
	});

	it("returns every candidate when there are fewer than three", () => {
		expect(pickHighlights(CHANGELOG, ["0.12.1"])).toEqual(["Added old."]);
	});

	it("returns [] when no candidate is in the skipped list", () => {
		expect(pickHighlights(CHANGELOG, ["0.11.0"])).toEqual([]);
	});

	it("returns [] when a skipped release holds only migration bullets", () => {
		const changelog = [
			"## [0.13.1]",
			"### Changed",
			"- [migration] Rename a field.",
			"  - Detect: old form.",
		].join("\n");
		expect(pickHighlights(changelog, ["0.13.1"])).toEqual([]);
	});

	it("returns lines of at most 120 characters", () => {
		const long = `${"word ".repeat(60)}end`;
		const changelog = ["## [0.13.1]", "### Added", `- ${long}`].join("\n");
		const [line] = pickHighlights(changelog, ["0.13.1"]);
		expect(line.length).toBeLessThanOrEqual(120);
	});
});
