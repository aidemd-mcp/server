import { describe, expect, it } from "vitest";
import mintToken from "../../mintToken/index.js";
import { TOKEN_PATTERN } from "./index.js";

describe("tokenFormat", () => {
	it("matches a minted token", () => {
		expect(TOKEN_PATTERN.test(mintToken())).toBe(true);
	});

	it.each(["", "abc", "A".repeat(64), "g".repeat(64), "a".repeat(63), "a".repeat(65), `${"a".repeat(64)}\n`])(
		"rejects %j",
		(value) => {
			expect(TOKEN_PATTERN.test(value)).toBe(false);
		},
	);
});
