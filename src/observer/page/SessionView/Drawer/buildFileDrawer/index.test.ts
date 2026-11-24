import { describe, expect, it } from "vitest";
import buildFileDrawer from "./index.js";

describe("buildFileDrawer", () => {
	it("is a File with the path as a mono title and the text as one pre block headed by the file name", () => {
		expect(buildFileDrawer({ path: ".aide/session.aide", text: "line 1\nline 2" })).toEqual({
			kind: "File",
			title: ".aide/session.aide",
			titleMono: true,
			meta: null,
			blocks: [{ heading: "session.aide", icon: "file", badge: null, type: "pre", text: "line 1\nline 2" }],
		});
	});
});
