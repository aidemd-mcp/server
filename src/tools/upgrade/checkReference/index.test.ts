import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { listReferencePages, readCanonicalDoc } from "@/service/install/initContent/index.js";
import checkReference from "./index.js";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "check-reference-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

async function installPage(filePath: string, content: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, content, "utf-8");
}

describe("checkReference", () => {
	it("fresh project: every page is missing, by name", async () => {
		const results = await checkReference({ projectRoot: tempDir, docHubDir: ".aide/docs" });
		const entries = listReferencePages();

		expect(results).toHaveLength(entries.length);
		entries.forEach((entry, i) => {
			expect(results[i]).toMatchObject({
				name: `.aide/reference/${entry.hostPath}`,
				filePath: join(tempDir, ".aide", "reference", entry.hostPath),
				status: "missing",
				category: "reference",
				canonicalContent: readCanonicalDoc(entry.canonical),
			});
		});
	});

	it("installed pages match", async () => {
		for (const entry of listReferencePages()) {
			await installPage(
				join(tempDir, ".aide", "reference", entry.hostPath),
				readCanonicalDoc(entry.canonical),
			);
		}

		const results = await checkReference({ projectRoot: tempDir, docHubDir: ".aide/docs" });

		expect(results).toHaveLength(listReferencePages().length);
		for (const result of results) {
			expect(result.status).toBe("matches");
			expect(result.category).toBe("reference");
			expect(result).not.toHaveProperty("canonicalContent");
		}
	});

	it("a drifted page is reported on its own", async () => {
		const entries = listReferencePages();
		for (const entry of entries) {
			await installPage(
				join(tempDir, ".aide", "reference", entry.hostPath),
				readCanonicalDoc(entry.canonical),
			);
		}
		const drifted = entries[0];
		await installPage(join(tempDir, ".aide", "reference", drifted.hostPath), "drifted\n");

		const results = await checkReference({ projectRoot: tempDir, docHubDir: ".aide/docs" });

		results.forEach((result, i) => {
			if (i === 0) {
				expect(result.status).toBe("differs");
				expect(result.canonicalContent).toBe(readCanonicalDoc(drifted.canonical));
			} else {
				expect(result.status).toBe("matches");
				expect(result).not.toHaveProperty("canonicalContent");
			}
		});
	});

	it("never writes", async () => {
		await checkReference({ projectRoot: tempDir, docHubDir: ".aide/docs" });

		await expect(access(join(tempDir, ".aide", "reference"))).rejects.toThrow();
	});
});
