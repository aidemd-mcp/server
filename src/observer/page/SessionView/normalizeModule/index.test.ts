import { describe, expect, it } from "vitest";
import normalizeModule from "./index.js";

describe("normalizeModule", () => {
	it("leaves a project-relative module as it is", () => {
		expect(normalizeModule({ projectRoot: "/work/app", module: "src/tools/score" })).toBe("src/tools/score");
	});

	it("strips ./, trailing slashes and backslashes", () => {
		expect(normalizeModule({ projectRoot: "/work/app", module: "./src\\tools\\score/" })).toBe("src/tools/score");
	});

	it("strips the project root, whichever way it is written", () => {
		expect(normalizeModule({ projectRoot: "D:\\Code\\app", module: "d:/code/app/src/x" })).toBe("src/x");
		expect(normalizeModule({ projectRoot: "/work/app/", module: "/work/app/src/x" })).toBe("src/x");
	});

	it("names the project root itself `.`", () => {
		expect(normalizeModule({ projectRoot: "/work/app", module: "/work/app" })).toBe(".");
		expect(normalizeModule({ projectRoot: "/work/app", module: "." })).toBe(".");
	});

	it("does not fold the case of a posix root", () => {
		expect(normalizeModule({ projectRoot: "/work/app", module: "/WORK/app/src" })).toBe("WORK/app/src");
	});
});
