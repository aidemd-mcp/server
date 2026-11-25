import type { Readable } from "node:stream";

/**
 * Reads a stream as UTF-8 text up to `limit` bytes. Past the limit it keeps
 * draining (so the writer never blocks) but resolves null; a stream error
 * resolves null. Never rejects.
 */
export default function readStdin({ stream, limit }: { stream: Readable; limit: number }): Promise<string | null> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let size = 0;
		let over = false;
		stream.on("data", (chunk: Buffer | string) => {
			const buffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
			size += buffer.length;
			if (size > limit) {
				over = true;
				chunks.length = 0;
				return;
			}
			if (!over) chunks.push(buffer);
		});
		stream.on("end", () => resolve(over ? null : Buffer.concat(chunks).toString("utf8")));
		stream.on("error", () => resolve(null));
	});
}
