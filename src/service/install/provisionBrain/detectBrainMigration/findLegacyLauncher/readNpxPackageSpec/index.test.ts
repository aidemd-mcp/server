import { describe, it, expect } from "vitest";
import readNpxPackageSpec from "./index.js";

describe("readNpxPackageSpec", () => {
	it("reads a direct npx launcher with a pinned spec and -y", () => {
		expect(readNpxPackageSpec({ command: "npx", args: ["-y", "@bitbonsai/mcpvault@0.16.0", "/v"] })).toEqual({
			argsStart: 0,
			specIndex: 1,
			packageName: "@bitbonsai/mcpvault",
			version: "0.16.0",
			autoConfirm: true,
		});
	});

	it("reads the cmd /c npx form with an unversioned spec and no -y", () => {
		expect(readNpxPackageSpec({ command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", "C:\\vault"] })).toEqual({
			argsStart: 2,
			specIndex: 2,
			packageName: "@bitbonsai/mcpvault",
			version: null,
			autoConfirm: false,
		});
	});

	it("recognises NPX.CMD", () => {
		expect(readNpxPackageSpec({ command: "NPX.CMD", args: ["@bitbonsai/mcpvault"] })?.argsStart).toBe(0);
	});

	it("recognises a path-qualified npx", () => {
		expect(readNpxPackageSpec({ command: "C:\\Program Files\\nodejs\\npx.cmd", args: ["-y", "pkg@1.0.0"] })).toMatchObject({
			argsStart: 0,
			specIndex: 1,
			packageName: "pkg",
			version: "1.0.0",
		});
	});

	it("does not count -y that comes after the spec", () => {
		expect(readNpxPackageSpec({ command: "npx", args: ["@bitbonsai/mcpvault@0.16.0", "-y"] })?.autoConfirm).toBe(false);
	});

	it("counts --yes as auto-confirm", () => {
		expect(readNpxPackageSpec({ command: "npx", args: ["--yes", "@bitbonsai/mcpvault"] })?.autoConfirm).toBe(true);
	});

	it.each([[["-p", "pkg", "tool"]], [["--package", "pkg", "tool"]], [["--package=pkg", "tool"]], [["-y", "-p", "pkg", "tool"]]])(
		"returns null when the package comes from a flag: %j",
		(args) => {
			expect(readNpxPackageSpec({ command: "npx", args })).toBeNull();
		},
	);

	it("returns null for the global mcpvault launcher", () => {
		expect(readNpxPackageSpec({ command: "mcpvault", args: ["/vault"] })).toBeNull();
	});

	it("returns null for node server.js", () => {
		expect(readNpxPackageSpec({ command: "node", args: ["server.js"] })).toBeNull();
	});

	it("returns null when npx has no positional spec", () => {
		expect(readNpxPackageSpec({ command: "npx", args: ["-y"] })).toBeNull();
	});

	it("skips a null arg before the spec", () => {
		expect(readNpxPackageSpec({ command: "npx", args: [null, "-y", "@bitbonsai/mcpvault"] })).toMatchObject({
			specIndex: 2,
			autoConfirm: true,
		});
	});

	it("does not treat a leading @ as a version separator", () => {
		expect(readNpxPackageSpec({ command: "npx", args: ["@scope"] })).toMatchObject({ packageName: "@scope", version: null });
	});
});
