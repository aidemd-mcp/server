import type { StreamMessageName } from "../../types/index.js";

/** Frame one message; JSON.stringify never emits a raw newline, so the data stays on one line. */
export default function frame({ name, data }: { name: StreamMessageName; data: unknown }): string {
	return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}
