import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readClosingRecord, { CLOSING_RECORD_WINDOW_BYTES } from "./index.js";

const CLAUDE_ID = "c1f0a2b3-1111-4222-8333-444455556666";

let folder: string;
let transcript: string;

const message = JSON.stringify({ type: "user", sessionId: CLAUDE_ID, message: "hi" });
const closing = JSON.stringify({ type: "cost-state", sessionId: CLAUDE_ID, cost: 1 });

beforeEach(async () => {
	folder = await mkdtemp(path.join(tmpdir(), "aide-closing-record-"));
	transcript = path.join(folder, "transcript.jsonl");
});

afterEach(async () => {
	await rm(folder, { recursive: true, force: true });
});

describe("readClosingRecord", () => {
	it("is true when the transcript ends in a matching cost-state record", async () => {
		await writeFile(transcript, `${message}\n${closing}\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(true);
	});

	it("is false when a cost-state record is followed by a later message", async () => {
		await writeFile(transcript, `${message}\n${closing}\n${message}\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);
	});

	it("is false when the closing record names a different session", async () => {
		await writeFile(transcript, `${message}\n${JSON.stringify({ type: "cost-state", sessionId: "other" })}\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);
	});

	it("is false when the cost-state record carries no sessionId", async () => {
		await writeFile(transcript, `${message}\n${JSON.stringify({ type: "cost-state" })}\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);
	});

	it("tolerates trailing blank lines, CR and spaces", async () => {
		await writeFile(transcript, `${message}\r\n${closing}\r\n\n  \n\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(true);
	});

	it("reads a transcript that is only the closing record", async () => {
		await writeFile(transcript, closing);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(true);
	});

	it("finds the closing record at the end of a file larger than the window", async () => {
		await writeFile(transcript, `${"x".repeat(CLOSING_RECORD_WINDOW_BYTES * 2)}\n${closing}\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(true);
	});

	it("is false when the last line is longer than the window", async () => {
		const long = JSON.stringify({ type: "cost-state", sessionId: CLAUDE_ID, pad: "x".repeat(CLOSING_RECORD_WINDOW_BYTES * 2) });
		await writeFile(transcript, `${message}\n${long}\n`);

		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);
	});

	it("is false for a missing file, an undefined path and an empty file", async () => {
		await writeFile(transcript, "");

		expect(await readClosingRecord({ transcriptPath: path.join(folder, "gone.jsonl"), claudeSessionId: CLAUDE_ID })).toBe(false);
		expect(await readClosingRecord({ transcriptPath: undefined, claudeSessionId: CLAUDE_ID })).toBe(false);
		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);
	});

	it("is false for a JSON array, a non-JSON last line and another record type", async () => {
		await writeFile(transcript, `${message}\n[1,2]\n`);
		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);

		await writeFile(transcript, `${message}\nnot json\n`);
		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);

		await writeFile(transcript, `${JSON.stringify({ type: "summary", sessionId: CLAUDE_ID })}\n`);
		expect(await readClosingRecord({ transcriptPath: transcript, claudeSessionId: CLAUDE_ID })).toBe(false);
	});
});
