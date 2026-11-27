import { open } from "node:fs/promises";

/** How much of a transcript's tail is read to find its last record. */
export const CLOSING_RECORD_WINDOW_BYTES = 64 * 1024;

const LF = 0x0a;
const CR = 0x0d;
const SPACE = 0x20;

/**
 * Whether a Claude session's transcript ends in its own closing record: a last
 * line that is a JSON object of type `cost-state` carrying this session's
 * Claude id (brief commitments #114, #116, #117, #127). Only the file's tail
 * (`CLOSING_RECORD_WINDOW_BYTES`) is read, never the whole transcript. Every
 * failure (no path, missing or unreadable or empty file, a last record that
 * does not fit the window, not JSON, another type or another session) answers
 * false; it never throws and always closes the file.
 */
export default async function readClosingRecord({
	transcriptPath,
	claudeSessionId,
}: {
	transcriptPath: string | undefined;
	claudeSessionId: string;
}): Promise<boolean> {
	if (transcriptPath === undefined) return false;

	try {
		const handle = await open(transcriptPath, "r");
		try {
			const { size } = await handle.stat();
			const length = Math.min(size, CLOSING_RECORD_WINDOW_BYTES);
			if (length === 0) return false;

			const tail = Buffer.alloc(length);
			const { bytesRead } = await handle.read(tail, 0, length, size - length);

			let end = bytesRead;
			while (end > 0 && (tail[end - 1] === LF || tail[end - 1] === CR || tail[end - 1] === SPACE)) end -= 1;
			if (end === 0) return false;

			const start = tail.subarray(0, end).lastIndexOf(LF) + 1;
			// No line break in the window while the file is longer: the record does not fit.
			if (start === 0 && length < size) return false;

			const record: unknown = JSON.parse(tail.subarray(start, end).toString("utf-8"));
			if (typeof record !== "object" || record === null || Array.isArray(record)) return false;

			const { type, sessionId } = record as { type?: unknown; sessionId?: unknown };
			return type === "cost-state" && typeof sessionId === "string" && sessionId === claudeSessionId;
		} finally {
			await handle.close();
		}
	} catch {
		return false;
	}
}
