import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import inspect from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "aide-inspect-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("inspect", () => {
	it("finds a function declaration with JSDoc", async () => {
		await writeFile(
			join(tempDir, "greet.ts"),
			`/**
 * Says hello to a person.
 * @param name The person's name.
 * @returns A greeting string.
 */
export default function greet(name: string): string {
	return \`Hello, \${name}!\`;
}
`,
		);

		const result = await inspect(tempDir, "greet");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("function");
		expect(hit.name).toBe("greet");
		expect(hit.file).toBe("greet.ts");
		expect(hit.line).toBe(6);
		expect(hit.signature).toContain("function greet(name: string): string");
		expect(hit.signature).not.toContain("return");
		expect(hit.jsdoc).not.toBeNull();
		expect(hit.jsdoc!.description).toContain("Says hello to a person");
		expect(hit.jsdoc!.tags).toHaveLength(2);
		expect(hit.jsdoc!.tags[0].tag).toBe("param");
		expect(hit.jsdoc!.tags[1].tag).toBe("returns");
	});

	it("finds an arrow function assigned to const", async () => {
		await writeFile(
			join(tempDir, "math.ts"),
			`export const add = (a: number, b: number): number => a + b;
`,
		);

		const result = await inspect(tempDir, "add");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("arrow");
		expect(hit.name).toBe("add");
		expect(hit.file).toBe("math.ts");
	});

	it("truncates block-body arrow function — signature stops before body brace", async () => {
		await writeFile(
			join(tempDir, "transform.ts"),
			`export const transform = (x: number): number => {
	return x * 2;
};
`,
		);

		const result = await inspect(tempDir, "transform");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("arrow");
		expect(hit.name).toBe("transform");
		expect(hit.signature).toContain("(x: number): number =>");
		expect(hit.signature).not.toContain("return");
		expect(hit.signature).not.toContain("{");
	});

	it("finds a class declaration and appends truncation marker", async () => {
		await writeFile(
			join(tempDir, "service.ts"),
			`export class MyService {
	private value: number;

	constructor(value: number) {
		this.value = value;
	}

	getValue(): number {
		return this.value;
	}
}
`,
		);

		const result = await inspect(tempDir, "MyService");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("class");
		expect(hit.name).toBe("MyService");
		expect(hit.file).toBe("service.ts");
		// Signature should not include implementation bodies but should indicate members exist
		expect(hit.signature).toContain("MyService");
		expect(hit.signature).toContain("{ ... }");
		expect(hit.signature).not.toContain("this.value");
	});

	it("finds an interface declaration with full member list in signature", async () => {
		await writeFile(
			join(tempDir, "config.ts"),
			`export interface Config {
	host: string;
	port: number;
	debug: boolean;
}
`,
		);

		const result = await inspect(tempDir, "Config");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("interface");
		expect(hit.name).toBe("Config");
		expect(hit.file).toBe("config.ts");
		// Interface body IS the contract — all members must be present
		expect(hit.signature).toContain("host: string");
		expect(hit.signature).toContain("port: number");
		expect(hit.signature).toContain("debug: boolean");
	});

	it("finds a type alias", async () => {
		await writeFile(
			join(tempDir, "types.ts"),
			`export type Status = "active" | "inactive";
`,
		);

		const result = await inspect(tempDir, "Status");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("type-alias");
		expect(hit.name).toBe("Status");
		expect(hit.file).toBe("types.ts");
		expect(hit.signature).toContain('"active"');
	});

	it("finds a method declaration inside a class", async () => {
		await writeFile(
			join(tempDir, "calculator.ts"),
			`export class Calculator {
	multiply(a: number, b: number): number {
		return a * b;
	}
}
`,
		);

		const result = await inspect(tempDir, "multiply");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("method");
		expect(hit.name).toBe("multiply");
	});

	it("returns empty hits when symbol is not found", async () => {
		await writeFile(
			join(tempDir, "empty.ts"),
			`export function knownFunction(): void {}
`,
		);

		const result = await inspect(tempDir, "nonExistentSymbol");

		expect(result.hits).toHaveLength(0);
	});

	it("scopes search to a single file when file param is provided", async () => {
		await writeFile(
			join(tempDir, "a.ts"),
			`export function process(): void {}
`,
		);
		await writeFile(
			join(tempDir, "b.ts"),
			`export function process(): void {}
`,
		);

		const result = await inspect(tempDir, "process", "a.ts");

		expect(result.hits).toHaveLength(1);
		expect(result.hits[0].file).toBe("a.ts");
	});

	it("returns hits from multiple files when same symbol name appears in both", async () => {
		await writeFile(
			join(tempDir, "moduleA.ts"),
			`export function transform(input: string): string {
	return input.toUpperCase();
}
`,
		);
		await writeFile(
			join(tempDir, "moduleB.ts"),
			`export function transform(input: number): number {
	return input * 2;
}
`,
		);

		const result = await inspect(tempDir, "transform");

		expect(result.hits).toHaveLength(2);
		const files = result.hits.map((h) => h.file).sort();
		expect(files).toContain("moduleA.ts");
		expect(files).toContain("moduleB.ts");
	});

	it("truncates signature before function body — no body in signature", async () => {
		await writeFile(
			join(tempDir, "complex.ts"),
			`export function compute(x: number, y: number): number {
	const result = x * y + x / y;
	return result;
}
`,
		);

		const result = await inspect(tempDir, "compute");

		expect(result.hits).toHaveLength(1);
		const { signature } = result.hits[0];
		expect(signature).toContain("function compute(x: number, y: number): number");
		expect(signature).not.toContain("const result");
		expect(signature).not.toContain("return result");
		expect(signature).not.toContain("{");
	});

	it("returns null jsdoc when no JSDoc block is present", async () => {
		await writeFile(
			join(tempDir, "undocumented.ts"),
			`export function undocumented(x: number): number {
	return x + 1;
}
`,
		);

		const result = await inspect(tempDir, "undocumented");

		expect(result.hits).toHaveLength(1);
		expect(result.hits[0].jsdoc).toBeNull();
	});

	it("finds symbols in .js files", async () => {
		await writeFile(
			join(tempDir, "helper.js"),
			`/**
 * Formats a value as a string.
 */
function formatValue(value) {
	return String(value);
}
`,
		);

		const result = await inspect(tempDir, "formatValue");

		expect(result.hits).toHaveLength(1);
		const hit = result.hits[0];
		expect(hit.kind).toBe("function");
		expect(hit.name).toBe("formatValue");
		expect(hit.file).toBe("helper.js");
		expect(hit.jsdoc).not.toBeNull();
		expect(hit.jsdoc!.description).toContain("Formats a value");
	});
});
