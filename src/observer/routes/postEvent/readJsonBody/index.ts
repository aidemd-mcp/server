import type { IncomingMessage } from "node:http";

/**
 * Reads a request body as JSON, counting bytes as they arrive. Past `limit`
 * it stops keeping data but still drains the rest of the request, so the
 * caller can answer 413 on a connection that is not left half-read.
 */
export default function readJsonBody({
	req,
	limit,
}: {
	req: IncomingMessage;
	limit: number;
}): Promise<{ kind: "ok"; value: unknown } | { kind: "too-large" } | { kind: "malformed"; reason: string }> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let received = 0;
		let tooLarge = false;

		req.on("data", (chunk: Buffer | string) => {
			if (tooLarge) return;
			const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
			received += buffer.length;
			if (received > limit) {
				tooLarge = true;
				chunks.length = 0;
				return;
			}
			chunks.push(buffer);
		});

		req.on("error", reject);

		req.on("end", () => {
			if (tooLarge) {
				resolve({ kind: "too-large" });
				return;
			}
			try {
				resolve({ kind: "ok", value: JSON.parse(Buffer.concat(chunks).toString("utf-8")) });
			} catch (error) {
				resolve({ kind: "malformed", reason: (error as Error).message });
			}
		});
	});
}
