import { describe, expect, it } from "vitest";
import isTokenFree from "./index.js";

describe("isTokenFree", () => {
	it("is false for a route that requires the token, whatever Accept says", () => {
		expect(isTokenFree({ tokenAccess: "required", accept: "text/html" })).toBe(false);
		expect(isTokenFree({ tokenAccess: "required", accept: undefined })).toBe(false);
	});

	it("is true for an open route whatever Accept says", () => {
		expect(isTokenFree({ tokenAccess: "open", accept: undefined })).toBe(true);
		expect(isTokenFree({ tokenAccess: "open", accept: "application/json" })).toBe(true);
	});

	it("is true for an open-for-html route only when Accept lists text/html", () => {
		expect(isTokenFree({ tokenAccess: "open-for-html", accept: "text/html,*/*;q=0.8" })).toBe(true);
		expect(isTokenFree({ tokenAccess: "open-for-html", accept: "application/json" })).toBe(false);
		expect(isTokenFree({ tokenAccess: "open-for-html", accept: undefined })).toBe(false);
	});
});
